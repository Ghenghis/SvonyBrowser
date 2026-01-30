# Run Development Environment
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
param(
    [switch]$Clean = $false,
    [switch]$Verbose = $false,
    [string]$Configuration = "Debug"
)

$ErrorActionPreference = 'Stop'

Write-Information "=== SVONY BROWSER - DEVELOPMENT STARTUP ===" -InformationAction Continue

$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

# 1. PRE-FLIGHT CHECKS
Write-Information "`n[1/6] Pre-flight Checks..." -InformationAction Continue

# Run doctor script first
Write-Information "  → Running system doctor..." -InformationAction Continue
& "$PSScriptRoot\doctor.ps1" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Information "  ✗ System check failed - run .\scripts\doctor.ps1 to diagnose" -InformationAction Continue
    exit 1
}
Write-Information "  ✓ System check passed" -InformationAction Continue

# 2. DEPENDENCY RESTORATION
Write-Information "`n[2/6] Dependency Restoration..." -InformationAction Continue

# Restore NuGet packages
if (Get-ChildItem "*.sln" -ErrorAction SilentlyContinue) {
    Write-Information "  → Restoring NuGet packages..." -InformationAction Continue
    try {
        if ($Clean) {
            dotnet clean --configuration $Configuration
            Write-Information "    Cleaned previous build artifacts" -InformationAction Continue
        }
        
        dotnet restore
        Write-Information "  ✓ NuGet packages restored" -InformationAction Continue
    }
    catch {
        Write-Information "  ✗ NuGet restore failed: $_" -InformationAction Continue
        exit 1
    }
}
else {
    Write-Information "  ℹ No .NET solution found" -InformationAction Continue
}

# Restore npm packages if package.json exists
if (Test-Path "package.json") {
    Write-Information "  → Restoring npm packages..." -InformationAction Continue
    try {
        if ($Clean -and (Test-Path "node_modules")) {
            Remove-Item "node_modules" -Recurse -Force
            Write-Information "    Cleaned node_modules" -InformationAction Continue
        }
        
        npm ci --silent
        Write-Information "  ✓ npm packages restored" -InformationAction Continue
    }
    catch {
        Write-Information "  ✗ npm install failed: $_" -InformationAction Continue
        exit 1
    }
}

# 3. DATABASE SETUP (if Docker Compose exists)
Write-Information "`n[3/6] Database Setup..." -InformationAction Continue

if (Test-Path "docker-compose.yml") {
    Write-Information "  → Starting database services..." -InformationAction Continue
    try {
        # Start only database services (not the main app)
        docker-compose up -d mysql phpmyadmin 2>$null
        
        # Wait for database to be ready
        $maxWait = 30
        $waited = 0
        do {
            Start-Sleep 2
            $waited += 2
            $dbReady = docker-compose exec -T mysql mysql -h localhost -u root -proot -e "SELECT 1" 2>$null
        } while (-not $dbReady -and $waited -lt $maxWait)
        
        if ($dbReady) {
            Write-Information "  ✓ Database services ready" -InformationAction Continue
            Write-Information "    MySQL: localhost:3306" -InformationAction Continue
            Write-Information "    phpMyAdmin: http://localhost:8081" -InformationAction Continue
        }
        else {
            Write-Information "  ⚠ Database services started but may not be ready" -InformationAction Continue
        }
    }
    catch {
        Write-Information "  ⚠ Database setup failed: $_" -InformationAction Continue
        Write-Information "    Continuing without database services..." -InformationAction Continue
    }
}
else {
    Write-Information "  ℹ No Docker Compose file - skipping database setup" -InformationAction Continue
}

# 4. BUILD PROJECT
Write-Information "`n[4/6] Building Project..." -InformationAction Continue

# Build .NET project
if (Get-ChildItem "*.sln" -ErrorAction SilentlyContinue) {
    Write-Information "  → Building .NET solution..." -InformationAction Continue
    try {
        dotnet build --configuration $Configuration --no-restore
        Write-Information "  ✓ .NET build completed" -InformationAction Continue
    }
    catch {
        Write-Information "  ✗ .NET build failed: $_" -InformationAction Continue
        exit 1
    }
}

# Build frontend if needed
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    if ($packageJson.scripts.build) {
        Write-Information "  → Building frontend..." -InformationAction Continue
        try {
            npm run build --silent
            Write-Information "  ✓ Frontend build completed" -InformationAction Continue
        }
        catch {
            Write-Information "  ⚠ Frontend build failed: $_" -InformationAction Continue
        }
    }
}

# 5. START DEVELOPMENT SERVERS
Write-Information "`n[5/6] Starting Development Servers..." -InformationAction Continue

# Start .NET application
$webProjects = Get-ChildItem "*Web*.csproj", "*Api*.csproj", "*Server*.csproj" -ErrorAction SilentlyContinue
if ($webProjects) {
    $mainProject = $webProjects[0]
    Write-Information "  → Starting web application: $($mainProject.BaseName)" -InformationAction Continue
    
    # Check if there's a specific launch profile
    $launchSettings = Join-Path $mainProject.DirectoryName "Properties\launchSettings.json"
    if (Test-Path $launchSettings) {
        $settings = Get-Content $launchSettings | ConvertFrom-Json
        $profiles = $settings.profiles.PSObject.Properties.Name
        Write-Information "    Available profiles: $($profiles -join ', ')" -InformationAction Continue
        
        # Use the first non-IIS profile
        $launchProfile = $profiles | Where-Object { $_ -ne "IIS Express" } | Select-Object -First 1
        if ($launchProfile) {
            Write-Information "    Using profile: $launchProfile" -InformationAction Continue
        }
    }
    
    try {
        # Start the web application in background
        $webProcess = Start-Process -FilePath "dotnet" -ArgumentList "run", "--project", $mainProject.FullName, "--configuration", $Configuration -PassThru -NoNewWindow
        Start-Sleep 3
        
        # Check if process is still running
        if (-not $webProcess.HasExited) {
            Write-Information "  ✓ Web application started (PID: $($webProcess.Id))" -InformationAction Continue
            
            # Try to determine the URL
            $url = "http://localhost:5000"  # Default
            if (Test-Path $launchSettings) {
                $settings = Get-Content $launchSettings | ConvertFrom-Json
                $firstProfile = $settings.profiles.PSObject.Properties.Value | Where-Object { $_.applicationUrl } | Select-Object -First 1
                if ($firstProfile) {
                    $url = $firstProfile.applicationUrl.Split(';')[0]
                }
            }
            Write-Information "    URL: $url" -InformationAction Continue
            
            # Test if the application is responding
            Start-Sleep 2
            try {
                $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Write-Information "    ✓ Application responding" -InformationAction Continue
                }
                else {
                    Write-Information "    ⚠ Application may still be starting..." -InformationAction Continue
                }
            }
            catch {
                Write-Information "    ⚠ Application starting (may take a moment)" -InformationAction Continue
            }
        }
        else {
            Write-Information "  ✗ Web application failed to start" -InformationAction Continue
            exit 1
        }
    }
    catch {
        Write-Information "  ✗ Failed to start web application: $_" -InformationAction Continue
        exit 1
    }
}

# Start frontend dev server if available
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    if ($packageJson.scripts.dev -or $packageJson.scripts.start) {
        $script = if ($packageJson.scripts.dev) { "dev" } else { "start" }
        Write-Information "  → Starting frontend dev server..." -InformationAction Continue
        
        try {
            $frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run", $script -PassThru -NoNewWindow
            Start-Sleep 2
            
            if (-not $frontendProcess.HasExited) {
                Write-Information "  ✓ Frontend dev server started (PID: $($frontendProcess.Id))" -InformationAction Continue
                Write-Information "    URL: http://localhost:3000 (typical)" -InformationAction Continue
            }
        }
        catch {
            Write-Information "  ⚠ Frontend dev server start failed: $_" -InformationAction Continue
        }
    }
}

# 6. DEVELOPMENT ENVIRONMENT SUMMARY
Write-Information "`n[6/6] Development Environment Ready!" -InformationAction Continue

Write-Information "`nSERVICES RUNNING:" -InformationAction Continue
if (Test-Path "docker-compose.yml") {
    Write-Information "  • MySQL Database: localhost:3306" -InformationAction Continue
    Write-Information "  • phpMyAdmin: http://localhost:8081" -InformationAction Continue
}

$processes = Get-Process | Where-Object { $_.ProcessName -eq "dotnet" -and $_.Id -eq $webProcess.Id }
if ($processes) {
    Write-Information "  • Web Application: http://localhost:5000" -InformationAction Continue
}

if ($frontendProcess -and -not $frontendProcess.HasExited) {
    Write-Information "  • Frontend Dev Server: http://localhost:3000" -InformationAction Continue
}

Write-Information "`nDEVELOPMENT COMMANDS:" -InformationAction Continue
Write-Information "  Run tests:     .\scripts\test.ps1" -InformationAction Continue
Write-Information "  Format code:   .\scripts\format.ps1" -InformationAction Continue
Write-Information "  Lint code:     .\scripts\lint.ps1" -InformationAction Continue
Write-Information "  Build release: .\scripts\build.ps1" -InformationAction Continue
Write-Information "  Full compliance check: .\scripts\compliance\run-all-layers.ps1" -InformationAction Continue

Write-Information "`nSTOP DEVELOPMENT:" -InformationAction Continue
Write-Information "  Stop all: docker-compose down" -InformationAction Continue
Write-Information "  Stop web: Stop-Process -Id $($webProcess.Id)" -InformationAction Continue
if ($frontendProcess) {
    Write-Information "  Stop frontend: Stop-Process -Id $($frontendProcess.Id)" -InformationAction Continue
}

if ($Verbose) {
    Write-Information "`nDEBUG INFO:" -InformationAction Continue
    Write-Information "  Project Root: $projectRoot" -InformationAction Continue
    Write-Information "  Configuration: $Configuration" -InformationAction Continue
    Write-Information "  Clean Build: $Clean" -InformationAction Continue
}

Write-Information "`n🚀 Development environment is ready! Happy coding!" -InformationAction Continue

# Keep console open to show running services
Write-Information "`nPress Ctrl+C to stop all services..." -InformationAction Continue
try {
    while ($true) {
        Start-Sleep 1
        
        # Check if main process is still running
        if ($webProcess -and $webProcess.HasExited) {
            Write-Information "`n⚠ Main web process has exited" -InformationAction Continue
            break
        }
    }
}
catch {
    Write-Information "`n🛑 Shutting down development environment..." -InformationAction Continue
    
    # Stop processes gracefully
    if ($webProcess -and -not $webProcess.HasExited) {
        $webProcess.Kill()
    }
    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        $frontendProcess.Kill()
    }
    
    Write-Information "Development session ended." -InformationAction Continue
}
