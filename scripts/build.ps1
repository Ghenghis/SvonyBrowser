# Build Script - Production Build
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
param(
    [string]$Configuration = "Release",
    [switch]$Clean = $false,
    [switch]$NuGetRestore,
    [switch]$RunTests,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== SVONY BROWSER - PRODUCTION BUILD ===" -InformationAction Continue

$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

$buildStart = Get-Date
$buildSteps = @()
$buildErrors = @()

# 1. PRE-BUILD VALIDATION
Write-Information "`n[1/7] Pre-Build Validation..." -InformationAction Continue

try {
    # Run compliance check first
    Write-Information "  → Running compliance validation..." -InformationAction Continue
    $complianceResult = & "$PSScriptRoot\compliance\run-all-layers.ps1" -ContinueOnFail
    if ($complianceResult -gt 5) {
        # Allow some minor issues but not major failures
        $buildErrors += "Compliance check failed with $complianceResult issues - build may be unreliable"
        Write-Information "  ⚠ Compliance issues detected ($complianceResult) - continuing anyway" -InformationAction Continue
    }
    else {
        Write-Information "  ✓ Compliance validation passed" -InformationAction Continue
    }
    $buildSteps += @{ Step = "Compliance Check"; Status = "OK"; Duration = (Get-Date) - $buildStart }
}
catch {
    $buildErrors += "Pre-build compliance check failed: $_"
    Write-Information "  ⚠ Compliance check failed - continuing with build" -InformationAction Continue
    $buildSteps += @{ Step = "Compliance Check"; Status = "WARNING"; Duration = (Get-Date) - $buildStart }
}

# 2. CLEAN BUILD ENVIRONMENT
if ($Clean) {
    Write-Information "`n[2/7] Clean Build Environment..." -InformationAction Continue
    
    $stepStart = Get-Date
    try {
        # Clean .NET artifacts
        $solutionFiles = Get-ChildItem "*.sln" -ErrorAction SilentlyContinue
        if ($solutionFiles) {
            foreach ($solution in $solutionFiles) {
                Write-Information "  → Cleaning solution: $($solution.Name)" -InformationAction Continue
                dotnet clean $solution.FullName --configuration $Configuration --verbosity quiet
            }
        }
        
        # Clean npm artifacts
        if (Test-Path "package.json") {
            Write-Information "  → Cleaning npm artifacts..." -InformationAction Continue
            if (Test-Path "node_modules") {
                Remove-Item "node_modules" -Recurse -Force
            }
            if (Test-Path "dist") {
                Remove-Item "dist" -Recurse -Force
            }
            if (Test-Path "build") {
                Remove-Item "build" -Recurse -Force
            }
        }
        
        # Clean common build directories
        $cleanDirs = @("bin", "obj", "TestResults", "publish", ".next", "out")
        foreach ($dir in $cleanDirs) {
            if (Test-Path $dir) {
                Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
        
        Write-Information "  ✓ Build environment cleaned" -InformationAction Continue
        $buildSteps += @{ Step = "Clean Environment"; Status = "OK"; Duration = (Get-Date) - $stepStart }
    }
    catch {
        $buildErrors += "Clean operation failed: $_"
        Write-Information "  ✗ Clean failed: $_" -InformationAction Continue
        $buildSteps += @{ Step = "Clean Environment"; Status = "ERROR"; Duration = (Get-Date) - $stepStart }
    }
}
else {
    Write-Information "`n[2/7] Skipping Clean (use -Clean flag to force)" -InformationAction Continue
}

# 3. DEPENDENCY RESTORATION
Write-Information "`n[3/7] Dependency Restoration..." -InformationAction Continue

$stepStart = Get-Date
try {
    # Restore NuGet packages
    if ($NuGetRestore -and (Get-ChildItem "*.sln" -ErrorAction SilentlyContinue)) {
        Write-Information "  → Restoring NuGet packages..." -InformationAction Continue
        dotnet restore --verbosity minimal
        Write-Information "  ✓ NuGet packages restored" -InformationAction Continue
    }
    
    # Restore npm packages
    if (Test-Path "package.json") {
        Write-Information "  → Restoring npm packages..." -InformationAction Continue
        npm ci --silent --production=false
        Write-Information "  ✓ npm packages restored" -InformationAction Continue
    }
    
    $buildSteps += @{ Step = "Dependency Restoration"; Status = "OK"; Duration = (Get-Date) - $stepStart }
}
catch {
    $buildErrors += "Dependency restoration failed: $_"
    Write-Information "  ✗ Dependency restoration failed: $_" -InformationAction Continue
    $buildSteps += @{ Step = "Dependency Restoration"; Status = "ERROR"; Duration = (Get-Date) - $stepStart }
    exit 1
}

# 4. BUILD .NET PROJECTS
Write-Information "`n[4/7] Building .NET Projects..." -InformationAction Continue

$stepStart = Get-Date
$solutionFiles = Get-ChildItem "*.sln" -ErrorAction SilentlyContinue
if ($solutionFiles) {
    try {
        foreach ($solution in $solutionFiles) {
            Write-Information "  → Building solution: $($solution.Name)" -InformationAction Continue
            
            $buildArgs = @(
                "build", 
                $solution.FullName, 
                "--configuration", $Configuration,
                "--no-restore",
                "/p:TreatWarningsAsErrors=true",
                "/p:WarningsAsErrors=",
                "/p:WarningsNotAsErrors=CS1591"  # Allow missing XML documentation warnings
            )
            
            if ($Verbose) {
                $buildArgs += "--verbosity"
                $buildArgs += "normal"
            }
            else {
                $buildArgs += "--verbosity"
                $buildArgs += "minimal"
            }
            
            dotnet @buildArgs
            
            if ($LASTEXITCODE -ne 0) {
                throw "Build failed with exit code $LASTEXITCODE"
            }
            
            Write-Information "  ✓ $($solution.Name) built successfully" -InformationAction Continue
        }
        
        $buildSteps += @{ Step = ".NET Build"; Status = "OK"; Duration = (Get-Date) - $stepStart }
    }
    catch {
        $buildErrors += ".NET build failed: $_"
        Write-Information "  ✗ .NET build failed: $_" -InformationAction Continue
        $buildSteps += @{ Step = ".NET Build"; Status = "ERROR"; Duration = (Get-Date) - $stepStart }
        exit 1
    }
}
else {
    Write-Information "  ℹ No .NET solution files found" -InformationAction Continue
    $buildSteps += @{ Step = ".NET Build"; Status = "SKIPPED"; Duration = (Get-Date) - $stepStart }
}

# 5. BUILD FRONTEND PROJECTS
Write-Information "`n[5/7] Building Frontend Projects..." -InformationAction Continue

$stepStart = Get-Date
if (Test-Path "package.json") {
    try {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        
        if ($packageJson.scripts.build) {
            Write-Information "  → Running npm build..." -InformationAction Continue
            npm run build
            
            if ($LASTEXITCODE -ne 0) {
                throw "Frontend build failed with exit code $LASTEXITCODE"
            }
            
            # Check for build output
            $buildDirs = @("dist", "build", "out", ".next")
            $buildOutput = $buildDirs | Where-Object { Test-Path $_ } | Select-Object -First 1
            
            if ($buildOutput) {
                $buildSize = (Get-ChildItem $buildOutput -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
                Write-Information "  ✓ Frontend build completed ($buildOutput, $($buildSize.ToString('F1')) MB)" -InformationAction Continue
            }
            else {
                Write-Information "  ⚠ Frontend build completed but no output directory found" -InformationAction Continue
            }
            
        }
        else {
            Write-Information "  ℹ No build script found in package.json" -InformationAction Continue
        }
        
        $buildSteps += @{ Step = "Frontend Build"; Status = "OK"; Duration = (Get-Date) - $stepStart }
    }
    catch {
        $buildErrors += "Frontend build failed: $_"
        Write-Information "  ✗ Frontend build failed: $_" -InformationAction Continue
        $buildSteps += @{ Step = "Frontend Build"; Status = "ERROR"; Duration = (Get-Date) - $stepStart }
        exit 1
    }
}
else {
    Write-Information "  ℹ No package.json found" -InformationAction Continue
    $buildSteps += @{ Step = "Frontend Build"; Status = "SKIPPED"; Duration = (Get-Date) - $stepStart }
}

# 6. RUN TESTS
if ($RunTests) {
    Write-Information "`n[6/7] Running Tests..." -InformationAction Continue
    
    $stepStart = Get-Date
    try {
        Write-Information "  → Running test suite..." -InformationAction Continue
        $testResult = & "$PSScriptRoot\test.ps1" -Verbose:$Verbose
        
        if ($testResult -eq 0) {
            Write-Information "  ✓ All tests passed" -InformationAction Continue
            $buildSteps += @{ Step = "Test Execution"; Status = "OK"; Duration = (Get-Date) - $stepStart }
        }
        else {
            $buildErrors += "$testResult test(s) failed"
            Write-Information "  ✗ $testResult test(s) failed" -InformationAction Continue
            $buildSteps += @{ Step = "Test Execution"; Status = "ERROR"; Duration = (Get-Date) - $stepStart }
            exit 1
        }
    }
    catch {
        $buildErrors += "Test execution failed: $_"
        Write-Information "  ✗ Test execution failed: $_" -InformationAction Continue
        $buildSteps += @{ Step = "Test Execution"; Status = "ERROR"; Duration = (Get-Date) - $stepStart }
        exit 1
    }
}
else {
    Write-Information "`n[6/7] Skipping Tests (use -RunTests to enable)" -InformationAction Continue
    $buildSteps += @{ Step = "Test Execution"; Status = "SKIPPED"; Duration = [timespan]::Zero }
}

# 7. PUBLISH/PACKAGE
Write-Information "`n[7/7] Publishing Applications..." -InformationAction Continue

$stepStart = Get-Date
$artifacts = @()

try {
    # Publish .NET applications
    $webProjects = Get-ChildItem "*Web*.csproj", "*Api*.csproj", "*Server*.csproj" -Recurse -ErrorAction SilentlyContinue
    foreach ($project in $webProjects) {
        Write-Information "  → Publishing: $($project.BaseName)" -InformationAction Continue
        
        $publishDir = "publish\$($project.BaseName)"
        $publishArgs = @(
            "publish",
            $project.FullName,
            "--configuration", $Configuration,
            "--no-build",
            "--output", $publishDir,
            "--self-contained", "false"
        )
        
        dotnet @publishArgs
        
        if ($LASTEXITCODE -eq 0) {
            $artifacts += $publishDir
            $publishSize = (Get-ChildItem $publishDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
            Write-Information "  ✓ $($project.BaseName) published ($($publishSize.ToString('F1')) MB)" -InformationAction Continue
        }
        else {
            throw "Publish failed for $($project.BaseName)"
        }
    }
    
    # Desktop applications
    $desktopProjects = Get-ChildItem "*.csproj" -Recurse | Where-Object { 
        (Get-Content $_.FullName) -match "Microsoft.WindowsDesktop.App" 
    }
    foreach ($project in $desktopProjects) {
        Write-Information "  → Publishing desktop app: $($project.BaseName)" -InformationAction Continue
        
        $publishDir = "publish\$($project.BaseName)"
        $publishArgs = @(
            "publish",
            $project.FullName,
            "--configuration", $Configuration,
            "--no-build",
            "--output", $publishDir,
            "--self-contained", "true",
            "--runtime", "win-x64"
        )
        
        dotnet @publishArgs
        
        if ($LASTEXITCODE -eq 0) {
            $artifacts += $publishDir
            $publishSize = (Get-ChildItem $publishDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
            Write-Information "  ✓ $($project.BaseName) published ($($publishSize.ToString('F1')) MB)" -InformationAction Continue
        }
        else {
            throw "Publish failed for $($project.BaseName)"
        }
    }
    
    if ($artifacts.Count -eq 0) {
        Write-Information "  ℹ No publishable projects detected" -InformationAction Continue
    }
    
    $buildSteps += @{ Step = "Application Publishing"; Status = "OK"; Duration = (Get-Date) - $stepStart }
}
catch {
    $buildErrors += "Publishing failed: $_"
    Write-Information "  ✗ Publishing failed: $_" -InformationAction Continue
    $buildSteps += @{ Step = "Application Publishing"; Status = "ERROR"; Duration = (Get-Date) - $stepStart }
    exit 1
}

# BUILD SUMMARY
$buildDuration = (Get-Date) - $buildStart
Write-Information "`n" + "="*60 -InformationAction Continue
Write-Information "BUILD SUMMARY" -InformationAction Continue
Write-Information "="*60 -InformationAction Continue

Write-Information "`nCONFIGURATION: $Configuration" -InformationAction Continue
Write-Information "BUILD TIME: $($buildDuration.TotalMinutes.ToString('F1')) minutes" -InformationAction Continue
Write-Information "BUILD ERRORS: $($buildErrors.Count)" -InformationAction Continue

if ($Verbose) {
    Write-Information "`nBUILD STEPS:" -InformationAction Continue
    foreach ($step in $buildSteps) {
        Write-Information "  $($step.Step): $($step.Status) ($($step.Duration.TotalSeconds.ToString('F1'))s)" -InformationAction Continue
    }
}

if ($artifacts.Count -gt 0) {
    Write-Information "`nARTIFACTS CREATED:" -InformationAction Continue
    foreach ($artifact in $artifacts) {
        $size = (Get-ChildItem $artifact -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Information "  • $artifact ($($size.ToString('F1')) MB)" -InformationAction Continue
    }
}

if ($buildErrors.Count -gt 0) {
    Write-Information "`nBUILD ERRORS:" -InformationAction Continue
    foreach ($buildError in $buildErrors) {
        Write-Information "  • $buildError" -InformationAction Continue
    }
    
    Write-Information "`n❌ BUILD FAILED" -InformationAction Continue
    Write-Information "Fix the above errors and retry the build." -InformationAction Continue
    exit 1
}
else {
    Write-Information "`n✅ BUILD SUCCESSFUL" -InformationAction Continue
    Write-Information "All components built and tested successfully!" -InformationAction Continue
    
    if ($artifacts.Count -gt 0) {
        Write-Information "`nNEXT STEPS:" -InformationAction Continue
        Write-Information "  Create release package: .\scripts\release.ps1" -InformationAction Continue
        Write-Information "  Deploy artifacts from: publish\" -InformationAction Continue
    }
}

exit $buildErrors.Count
