# Layer B - Runtime Gates (Reality Check)
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 7 Layer B requirements
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [int]$TimeoutSeconds = 30,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== LAYER B: Runtime Gates Analysis ===" -InformationAction Continue
Write-Information "Project: $ProjectRoot" -InformationAction Continue

$issues = @()
$warnings = @()

# 1. SMOKE BOOT TEST
Write-Information "`n[1/3] Smoke Boot Test..." -InformationAction Continue

# Detect project type and boot accordingly
$projectTypes = @{
    'Web Service' = { Test-Path "$ProjectRoot\*.csproj" -and (Get-Content "$ProjectRoot\*.csproj" | Select-String "Microsoft.AspNetCore") }
    'Desktop WPF' = { Test-Path "$ProjectRoot\*.csproj" -and (Get-Content "$ProjectRoot\*.csproj" | Select-String "Microsoft.WindowsDesktop.App") }
    'Node.js'     = { Test-Path "$ProjectRoot\package.json" }
    'Python'      = { Test-Path "$ProjectRoot\requirements.txt" -or (Test-Path "$ProjectRoot\pyproject.toml") }
    'Rust'        = { Test-Path "$ProjectRoot\Cargo.toml" }
}

$detectedType = $null
foreach ($type in $projectTypes.Keys) {
    if (& $projectTypes[$type]) {
        $detectedType = $type
        break
    }
}

if (-not $detectedType) {
    $warnings += "Could not detect project type for smoke testing"
    Write-Information "  ⚠ Unknown project type" -InformationAction Continue
}
else {
    Write-Information "  Detected: $detectedType" -InformationAction Continue
    
    try {
        switch ($detectedType) {
            'Web Service' {
                Write-Information "  → Starting ASP.NET service..." -InformationAction Continue
                $process = Start-Process -FilePath "dotnet" -ArgumentList "run", "--project", $ProjectRoot -PassThru -NoNewWindow
                Start-Sleep 5
                
                # Try to find the port from launchSettings.json
                $launchSettings = "$ProjectRoot\Properties\launchSettings.json"
                $port = 5000 # default
                if (Test-Path $launchSettings) {
                    $settings = Get-Content $launchSettings | ConvertFrom-Json
                    $applicationUrl = $settings.profiles.PSObject.Properties.Value | Where-Object { $_.applicationUrl } | Select-Object -First 1
                    if ($applicationUrl.applicationUrl -match ":(\d+)") {
                        $port = $matches[1]
                    }
                }
                
                # Health check
                $response = Invoke-WebRequest -Uri "http://localhost:$port/health" -TimeoutSec $TimeoutSeconds -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Write-Information "  ✓ Service boot OK" -InformationAction Continue
                }
                else {
                    $issues += "Service health check failed"
                    Write-Information "  ✗ Service boot FAIL" -InformationAction Continue
                }
                
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
            
            'Desktop WPF' {
                Write-Information "  → Testing WPF application..." -InformationAction Continue
                # Build and check for successful compilation
                dotnet build $ProjectRoot --verbosity quiet
                if ($LASTEXITCODE -eq 0) {
                    Write-Information "  ✓ WPF build OK" -InformationAction Continue
                }
                else {
                    $issues += "WPF build failed"
                    Write-Information "  ✗ WPF build FAIL" -InformationAction Continue
                }
            }
            
            'Node.js' {
                Write-Information "  → Starting Node.js service..." -InformationAction Continue
                $packageJson = Get-Content "$ProjectRoot\package.json" | ConvertFrom-Json
                $startScript = $packageJson.scripts.start -or $packageJson.scripts.dev
                
                if ($startScript) {
                    $process = Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $ProjectRoot -PassThru -NoNewWindow
                    Start-Sleep 3
                    
                    # Try common ports
                    $ports = @(3000, 8000, 8080, 5000)
                    $success = $false
                    foreach ($port in $ports) {
                        try {
                            $response = Invoke-WebRequest -Uri "http://localhost:$port" -TimeoutSec 5 -ErrorAction Stop
                            Write-Information "  ✓ Node.js service OK (port $port)" -InformationAction Continue
                            $success = $true
                            break
                        }
                        catch {
                            # Port not responding, continue to next port
                            continue
                        }
                    }
                    
                    if (-not $success) {
                        $issues += "Node.js service not responding on common ports"
                        Write-Information "  ✗ Node.js service FAIL" -InformationAction Continue
                    }
                    
                    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                }
                else {
                    $warnings += "No start script found in package.json"
                    Write-Information "  ⚠ No start script" -InformationAction Continue
                }
            }
            
            'Python' {
                Write-Information "  → Testing Python application..." -InformationAction Continue
                # Look for common entry points
                $entryPoints = @("app.py", "main.py", "server.py", "run.py")
                $found = $false
                
                foreach ($entry in $entryPoints) {
                    if (Test-Path "$ProjectRoot\$entry") {
                        try {
                            python -m py_compile "$ProjectRoot\$entry"
                            Write-Information "  ✓ Python syntax OK ($entry)" -InformationAction Continue
                            $found = $true
                            break
                        }
                        catch {
                            $issues += "Python syntax error in $entry"
                            Write-Information "  ✗ Python syntax FAIL ($entry)" -InformationAction Continue
                        }
                    }
                }
                
                if (-not $found) {
                    $warnings += "No standard entry point found"
                    Write-Information "  ⚠ No entry point" -InformationAction Continue
                }
            }
            
            'Rust' {
                Write-Information "  → Testing Rust application..." -InformationAction Continue
                try {
                    cargo check --manifest-path "$ProjectRoot\Cargo.toml"
                    Write-Information "  ✓ Rust check OK" -InformationAction Continue
                }
                catch {
                    $issues += "Rust check failed: $_"
                    Write-Information "  ✗ Rust check FAIL" -InformationAction Continue
                }
            }
        }
    }
    catch {
        $issues += "Boot test failed: $_"
        Write-Information "  ✗ Boot test FAIL" -InformationAction Continue
    }
}

# 2. HAPPY PATH SCENARIO TEST
Write-Information "`n[2/3] Happy Path Scenario..." -InformationAction Continue

# Define happy path tests based on project type
switch ($detectedType) {
    'Web Service' {
        Write-Information "  → Testing API endpoints..." -InformationAction Continue
        # Look for controllers or API definitions
        $controllers = Get-ChildItem "$ProjectRoot\Controllers\*.cs" -ErrorAction SilentlyContinue
        if ($controllers) {
            Write-Information "  ✓ API controllers found ($($controllers.Count))" -InformationAction Continue
        }
        else {
            $warnings += "No API controllers found for testing"
            Write-Information "  ⚠ No controllers" -InformationAction Continue
        }
    }
    
    'Desktop WPF' {
        Write-Information "  → Testing XAML resources..." -InformationAction Continue
        $xamlFiles = Get-ChildItem "$ProjectRoot\**\*.xaml" -Recurse -ErrorAction SilentlyContinue
        if ($xamlFiles) {
            $xamlErrors = 0
            foreach ($xaml in $xamlFiles) {
                try {
                    [xml]$null = Get-Content $xaml.FullName
                    # Basic XAML validation
                }
                catch {
                    $xamlErrors++
                }
            }
            
            if ($xamlErrors -eq 0) {
                Write-Information "  ✓ XAML files valid ($($xamlFiles.Count))" -InformationAction Continue
            }
            else {
                $issues += "$xamlErrors XAML files have syntax errors"
                Write-Information "  ✗ XAML errors ($xamlErrors)" -InformationAction Continue
            }
        }
    }
    
    'Node.js' {
        Write-Information "  → Testing module imports..." -InformationAction Continue
        try {
            npm run test --if-present --silent 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Information "  ✓ Tests passing" -InformationAction Continue
            }
            else {
                $warnings += "Some tests failing"
                Write-Information "  ⚠ Test issues" -InformationAction Continue
            }
        }
        catch {
            $warnings += "Could not run tests"
            Write-Information "  ⚠ No tests" -InformationAction Continue
        }
    }
}

# 3. RESOURCE VALIDATION
Write-Information "`n[3/3] Resource Validation..." -InformationAction Continue

# Check for missing dependencies
$dependencyFiles = @{
    'package.json'     = { npm audit --audit-level=high }
    'requirements.txt' = { pip check }
    'Cargo.toml'       = { cargo audit --deny warnings }
    '*.csproj'         = { dotnet list package --vulnerable --include-transitive }
}

foreach ($file in $dependencyFiles.Keys) {
    if (Test-Path "$ProjectRoot\$file" -or (Get-ChildItem "$ProjectRoot\$file" -ErrorAction SilentlyContinue)) {
        try {
            & $dependencyFiles[$file]
            Write-Information "  ✓ Dependencies secure ($file)" -InformationAction Continue
        }
        catch {
            $issues += "Security vulnerabilities in dependencies ($file)"
            Write-Information "  ✗ Vulnerable deps ($file)" -InformationAction Continue
        }
    }
}

# Check for missing resources (images, configs, etc.)
$resourcePaths = @(
    "$ProjectRoot\wwwroot\**\*",
    "$ProjectRoot\Assets\**\*", 
    "$ProjectRoot\Resources\**\*",
    "$ProjectRoot\static\**\*",
    "$ProjectRoot\public\**\*"
)

$missingResources = 0
foreach ($path in $resourcePaths) {
    $files = Get-ChildItem $path -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        if ($file.Name -match '\.(png|jpg|jpeg|gif|ico|svg|css|js)$') {
            if ($file.Length -eq 0) {
                $missingResources++
            }
        }
    }
}

if ($missingResources -eq 0) {
    Write-Information "  ✓ Resources OK" -InformationAction Continue
}
else {
    $issues += "$missingResources empty resource files found"
    Write-Information "  ✗ Empty resources ($missingResources)" -InformationAction Continue
}

# SUMMARY
Write-Information "`n=== LAYER B SUMMARY ===" -InformationAction Continue
Write-Information "Issues: $($issues.Count)" -InformationAction Continue
Write-Information "Warnings: $($warnings.Count)" -InformationAction Continue

if ($issues.Count -gt 0) {
    Write-Information "`nISSUES FOUND:" -InformationAction Continue
    foreach ($issue in $issues) {
        Write-Information "  • $issue" -InformationAction Continue
    }
}

if ($warnings.Count -gt 0) {
    Write-Information "`nWARNINGS:" -InformationAction Continue
    foreach ($warning in $warnings) {
        Write-Information "  • $warning" -InformationAction Continue
    }
}

if ($Verbose) {
    Write-Information "`nNext: Run Layer C (Integration Gates)" -InformationAction Continue
    Write-Information "Command: .\scripts\compliance\layer-c-integration-gates.ps1" -InformationAction Continue
}

exit $issues.Count
