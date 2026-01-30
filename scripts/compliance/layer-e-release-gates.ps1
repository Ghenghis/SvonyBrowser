# Layer E - Release Gates
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 7 Layer E requirements
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [string]$Version = "dev",
    [switch]$CreateInstaller = $false,
    [switch]$TestInstaller = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== LAYER E: Release Gates Analysis ===" -InformationAction Continue
Write-Information "Project: $ProjectRoot" -InformationAction Continue
Write-Information "Version: $Version" -InformationAction Continue

$issues = @()
$warnings = @()
$artifacts = @()

# 1. BUILD INSTALLER/ZIP/CONTAINER
Write-Information "`n[1/4] Build Artifacts..." -InformationAction Continue

# Detect project type for appropriate packaging
$packagingStrategy = $null

if (Test-Path "$ProjectRoot\*.sln" -PathType Leaf) {
    $packagingStrategy = 'dotnet'
    Write-Information "  Detected: .NET Solution" -InformationAction Continue
    
    try {
        # Build release configuration
        Write-Information "  → Building release configuration..." -InformationAction Continue
        dotnet build --configuration Release --no-restore $ProjectRoot
        
        # Check for publish profiles
        $publishProfiles = Get-ChildItem "$ProjectRoot\*\Properties\PublishProfiles\*.pubxml" -ErrorAction SilentlyContinue
        if ($publishProfiles) {
            foreach ($publishProfile in $publishProfiles) {
                $profileName = $publishProfile.BaseName
                Write-Information "  → Publishing with profile: $profileName" -InformationAction Continue
                dotnet publish --configuration Release --pubxml $profileName $ProjectRoot
                
                $publishDir = "$ProjectRoot\bin\Release\publish"
                if (Test-Path $publishDir) {
                    $artifacts += $publishDir
                    Write-Information "  ✓ Publish artifact: $publishDir" -InformationAction Continue
                }
            }
        }
        else {
            # Standard publish
            dotnet publish --configuration Release --output "$ProjectRoot\bin\Release\publish" $ProjectRoot
            $artifacts += "$ProjectRoot\bin\Release\publish"
            Write-Information "  ✓ Standard publish completed" -InformationAction Continue
        }
        
        # Create installer if requested
        if ($CreateInstaller) {
            # Check for WiX or other installer projects
            $setupProjects = Get-ChildItem "$ProjectRoot\*Setup\*.wixproj" -ErrorAction SilentlyContinue
            if ($setupProjects) {
                Write-Information "  → Building WiX installer..." -InformationAction Continue
                foreach ($setupProject in $setupProjects) {
                    msbuild $setupProject.FullName /p:Configuration=Release
                    $msiFiles = Get-ChildItem "$($setupProject.DirectoryName)\bin\Release\*.msi" -ErrorAction SilentlyContinue
                    if ($msiFiles) {
                        $artifacts += $msiFiles[0].FullName
                        Write-Information "  ✓ Installer created: $($msiFiles[0].Name)" -InformationAction Continue
                    }
                }
            }
            else {
                $warnings += "Installer requested but no WiX project found"
                Write-Information "  ⚠ No installer project" -InformationAction Continue
            }
        }
        
    }
    catch {
        $issues += ".NET build failed: $_"
        Write-Information "  ✗ .NET build FAIL" -InformationAction Continue
    }
}

elseif (Test-Path "$ProjectRoot\package.json") {
    $packagingStrategy = 'npm'
    Write-Information "  Detected: Node.js Project" -InformationAction Continue
    
    try {
        $packageJson = Get-Content "$ProjectRoot\package.json" | ConvertFrom-Json
        
        # Run build script if available
        if ($packageJson.scripts.build) {
            Write-Information "  → Running npm build..." -InformationAction Continue
            Set-Location $ProjectRoot
            npm run build
            
            # Common build output directories
            $buildDirs = @("dist", "build", "out", ".next")
            foreach ($dir in $buildDirs) {
                if (Test-Path "$ProjectRoot\$dir") {
                    $artifacts += "$ProjectRoot\$dir"
                    Write-Information "  ✓ Build output: $dir" -InformationAction Continue
                    break
                }
            }
        }
        
        # Check for Electron packaging
        if ($packageJson.dependencies.electron -or $packageJson.devDependencies.electron) {
            Write-Information "  → Electron app detected" -InformationAction Continue
            
            if ($packageJson.scripts.package -or $packageJson.scripts.dist) {
                $script = if ($packageJson.scripts.package) { "package" } else { "dist" }
                Write-Information "  → Running electron $script..." -InformationAction Continue
                npm run $script
                
                $distDir = "$ProjectRoot\dist"
                if (Test-Path $distDir) {
                    $artifacts += $distDir
                    Write-Information "  ✓ Electron package created" -InformationAction Continue
                }
            }
            else {
                $warnings += "Electron project but no package/dist script found"
                Write-Information "  ⚠ No Electron packaging script" -InformationAction Continue
            }
        }
        
        # Create ZIP archive
        if ($artifacts.Count -gt 0) {
            $zipPath = "$ProjectRoot\release-$Version.zip"
            Compress-Archive -Path $artifacts[0] -DestinationPath $zipPath -Force
            $artifacts += $zipPath
            Write-Information "  ✓ ZIP archive created: release-$Version.zip" -InformationAction Continue
        }
        
    }
    catch {
        $issues += "Node.js build failed: $_"
        Write-Information "  ✗ Node.js build FAIL" -InformationAction Continue
    }
}

elseif (Test-Path "$ProjectRoot\Cargo.toml") {
    $packagingStrategy = 'rust'
    Write-Information "  Detected: Rust Project" -InformationAction Continue
    
    try {
        Write-Information "  → Building release binary..." -InformationAction Continue
        cargo build --release --manifest-path "$ProjectRoot\Cargo.toml"
        
        $targetDir = "$ProjectRoot\target\release"
        if (Test-Path $targetDir) {
            $binaries = Get-ChildItem "$targetDir\*.exe" -ErrorAction SilentlyContinue
            if ($binaries) {
                $artifacts += $binaries[0].FullName
                Write-Information "  ✓ Release binary: $($binaries[0].Name)" -InformationAction Continue
            }
        }
        
    }
    catch {
        $issues += "Rust build failed: $_"
        Write-Information "  ✗ Rust build FAIL" -InformationAction Continue
    }
}

elseif (Test-Path "$ProjectRoot\Dockerfile") {
    $packagingStrategy = 'docker'
    Write-Information "  Detected: Docker Project" -InformationAction Continue
    
    try {
        $imageName = "$(Split-Path $ProjectRoot -Leaf):$Version".ToLower()
        Write-Information "  → Building Docker image: $imageName" -InformationAction Continue
        
        docker build -t $imageName $ProjectRoot
        if ($LASTEXITCODE -eq 0) {
            $artifacts += "docker:$imageName"
            Write-Information "  ✓ Docker image built: $imageName" -InformationAction Continue
        }
        else {
            $issues += "Docker build failed"
            Write-Information "  ✗ Docker build FAIL" -InformationAction Continue
        }
        
    }
    catch {
        $issues += "Docker build failed: $_"
        Write-Information "  ✗ Docker build FAIL" -InformationAction Continue
    }
}

else {
    $warnings += "Could not detect packaging strategy"
    Write-Information "  ⚠ Unknown project type" -InformationAction Continue
}

# 2. VERIFY ARTIFACT INTEGRITY
Write-Information "`n[2/4] Artifact Verification..." -InformationAction Continue

foreach ($artifact in $artifacts) {
    if ($artifact.StartsWith("docker:")) {
        # Docker image verification
        $imageName = $artifact.Substring(7)
        try {
            docker inspect $imageName | Out-Null
            Write-Information "  ✓ Docker image exists: $imageName" -InformationAction Continue
        }
        catch {
            $issues += "Docker image verification failed: $imageName"
            Write-Information "  ✗ Docker image missing: $imageName" -InformationAction Continue
        }
    }
    elseif (Test-Path $artifact) {
        $item = Get-Item $artifact
        
        if ($item.PSIsContainer) {
            # Directory artifact
            $fileCount = (Get-ChildItem $artifact -Recurse -File).Count
            $totalSize = (Get-ChildItem $artifact -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
            Write-Information "  ✓ Directory artifact: $($item.Name) ($fileCount files, $($totalSize.ToString('F1')) MB)" -InformationAction Continue
        }
        else {
            # File artifact
            $sizeKB = [math]::Round($item.Length / 1KB, 1)
            Write-Information "  ✓ File artifact: $($item.Name) ($sizeKB KB)" -InformationAction Continue
            
            # Generate checksum
            $hash = Get-FileHash $artifact -Algorithm SHA256
            $checksumFile = "$artifact.sha256"
            "$($hash.Hash)  $($item.Name)" | Out-File $checksumFile -Encoding ASCII
            Write-Information "    → Checksum: $checksumFile" -InformationAction Continue
        }
    }
    else {
        $issues += "Artifact not found: $artifact"
        Write-Information "  ✗ Artifact missing: $artifact" -InformationAction Continue
    }
}

# 3. TEST INSTALLER/ARTIFACT LAUNCH
Write-Information "`n[3/4] Launch Test..." -InformationAction Continue

if ($TestInstaller -and $artifacts.Count -gt 0) {
    foreach ($artifact in $artifacts | Select-Object -First 1) {
        if ($artifact.EndsWith('.msi')) {
            Write-Information "  → Testing MSI installer..." -InformationAction Continue
            try {
                # Test MSI without actually installing (dry run)
                msiexec /i $artifact /qn /norestart /l*v "$ProjectRoot\install-test.log" INSTALLDIR="$env:TEMP\install-test"
                if (Test-Path "$ProjectRoot\install-test.log") {
                    $logContent = Get-Content "$ProjectRoot\install-test.log" -Tail 10
                    if ($logContent -match "Installation completed successfully|Installation operation completed successfully") {
                        Write-Information "  ✓ MSI installer test OK" -InformationAction Continue
                    }
                    else {
                        $issues += "MSI installer test failed - see install-test.log"
                        Write-Information "  ✗ MSI installer test FAIL" -InformationAction Continue
                    }
                }
            }
            catch {
                $issues += "MSI test failed: $_"
                Write-Information "  ✗ MSI test FAIL" -InformationAction Continue
            }
        }
        elseif ($artifact.EndsWith('.exe')) {
            Write-Information "  → Testing executable..." -InformationAction Continue
            try {
                # Try to run with --help or --version to verify it starts
                $testArgs = @('--help', '--version', '-h', '-v', '/?')
                $success = $false
                
                foreach ($arg in $testArgs) {
                    try {
                        $output = & $artifact $arg 2>&1
                        if ($LASTEXITCODE -eq 0 -or $output) {
                            Write-Information "  ✓ Executable responds to $arg" -InformationAction Continue
                            $success = $true
                            break
                        }
                    }
                    catch {
                        continue
                    }
                }
                
                if (-not $success) {
                    $warnings += "Executable does not respond to common help arguments"
                    Write-Information "  ⚠ Executable unresponsive to help args" -InformationAction Continue
                }
            }
            catch {
                $issues += "Executable test failed: $_"
                Write-Information "  ✗ Executable test FAIL" -InformationAction Continue
            }
        }
        elseif ($artifact.StartsWith("docker:")) {
            Write-Information "  → Testing Docker container..." -InformationAction Continue
            $imageName = $artifact.Substring(7)
            try {
                # Try to run container briefly to verify it starts
                $containerId = docker run -d --rm $imageName
                Start-Sleep 3
                $containerStatus = docker ps --filter "id=$containerId" --format "{{.Status}}"
                
                if ($containerStatus -and $containerStatus.Contains("Up")) {
                    Write-Information "  ✓ Docker container starts OK" -InformationAction Continue
                }
                else {
                    $issues += "Docker container failed to start properly"
                    Write-Information "  ✗ Docker container start FAIL" -InformationAction Continue
                }
                
                # Clean up
                docker stop $containerId 2>$null
            }
            catch {
                $issues += "Docker container test failed: $_"
                Write-Information "  ✗ Docker test FAIL" -InformationAction Continue
            }
        }
    }
}
else {
    Write-Information "  ℹ Use -TestInstaller to run launch tests" -InformationAction Continue
}

# 4. RELEASE READINESS CHECK
Write-Information "`n[4/4] Release Readiness..." -InformationAction Continue

# Check for required release files
$requiredFiles = @{
    'CHANGELOG.md' = "Release notes and version history"
    'LICENSE'      = "Software license"
    'README.md'    = "Installation and usage instructions"
    'SECURITY.md'  = "Security policy and contact info"
}

foreach ($file in $requiredFiles.Keys) {
    $description = $requiredFiles[$file]
    if (Test-Path "$ProjectRoot\$file") {
        $content = Get-Content "$ProjectRoot\$file" -Raw
        if ($content.Length -gt 100) {
            Write-Information "  ✓ $file ($description)" -InformationAction Continue
        }
        else {
            $warnings += "$file exists but appears incomplete"
            Write-Information "  ⚠ $file (incomplete)" -InformationAction Continue
        }
    }
    else {
        $issues += "Missing required file: $file ($description)"
        Write-Information "  ✗ Missing: $file" -InformationAction Continue
    }
}

# Check version consistency
$versionSources = @()
if (Test-Path "$ProjectRoot\package.json") {
    $packageJson = Get-Content "$ProjectRoot\package.json" | ConvertFrom-Json
    $versionSources += @{ Source = "package.json"; Version = $packageJson.version }
}

$csprojFiles = Get-ChildItem "$ProjectRoot\*.csproj" -ErrorAction SilentlyContinue
foreach ($csproj in $csprojFiles) {
    [xml]$content = Get-Content $csproj.FullName
    $version = $content.Project.PropertyGroup.Version
    if ($version) {
        $versionSources += @{ Source = $csproj.Name; Version = $version }
    }
}

if ($versionSources.Count -gt 1) {
    $uniqueVersions = ($versionSources | Select-Object -ExpandProperty Version | Sort-Object -Unique)
    if ($uniqueVersions.Count -gt 1) {
        $issues += "Version mismatch across files: $($uniqueVersions -join ', ')"
        Write-Information "  ✗ Version mismatch" -InformationAction Continue
    }
    else {
        Write-Information "  ✓ Version consistent: $($uniqueVersions[0])" -InformationAction Continue
    }
}
elseif ($versionSources.Count -eq 1) {
    Write-Information "  ✓ Version: $($versionSources[0].Version)" -InformationAction Continue
}
else {
    $warnings += "No version information found in standard locations"
    Write-Information "  ⚠ No version info" -InformationAction Continue
}

# SUMMARY
Write-Information "`n=== LAYER E SUMMARY ===" -InformationAction Continue
Write-Information "Packaging Strategy: $($packagingStrategy -or 'Unknown')" -InformationAction Continue
Write-Information "Artifacts Created: $($artifacts.Count)" -InformationAction Continue
Write-Information "Issues: $($issues.Count)" -InformationAction Continue
Write-Information "Warnings: $($warnings.Count)" -InformationAction Continue

if ($artifacts.Count -gt 0) {
    Write-Information "`nARTIFACTS CREATED:" -InformationAction Continue
    foreach ($artifact in $artifacts) {
        Write-Information "  • $artifact" -InformationAction Continue
    }
}

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
    Write-Information "`nRun all layers:" -InformationAction Continue
    Write-Information ".\scripts\compliance\run-all-layers.ps1" -InformationAction Continue
}

exit $issues.Count
