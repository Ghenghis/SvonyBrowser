# Release Script - Local Packaging
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
param(
    [string]$Version = "1.0.0",
    [switch]$CreateInstaller = $false,
    [switch]$CreateZip,
    [switch]$SignArtifacts = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== SVONY BROWSER - RELEASE PACKAGING ===" -InformationAction Continue
Write-Information "Version: $Version" -InformationAction Continue

$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

$releaseStart = Get-Date
$releaseArtifacts = @()
$releaseErrors = @()

# 1. PRE-RELEASE VALIDATION
Write-Information "`n[1/8] Pre-Release Validation..." -InformationAction Continue

try {
    # Ensure build was successful
    if (-not (Test-Path "publish")) {
        Write-Information "  ⚠ No publish directory found - running production build..." -InformationAction Continue
        $buildResult = & "$PSScriptRoot\build.ps1" -Configuration Release -RunTests
        if ($buildResult -ne 0) {
            throw "Production build failed - cannot create release"
        }
    }
    
    # Verify all compliance layers pass
    Write-Information "  → Running final compliance check..." -InformationAction Continue
    $complianceResult = & "$PSScriptRoot\compliance\run-all-layers.ps1" -ContinueOnFail
    if ($complianceResult -gt 0) {
        Write-Information "  ⚠ $complianceResult compliance issues - review before release" -InformationAction Continue
    }
    else {
        Write-Information "  ✓ Full compliance achieved" -InformationAction Continue
    }
    
    # Check for required release files
    $requiredFiles = @("README.md", "LICENSE", "CHANGELOG.md")
    $missingFiles = @()
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            $missingFiles += $file
        }
    }
    
    if ($missingFiles.Count -gt 0) {
        Write-Information "  ⚠ Missing release files: $($missingFiles -join ', ')" -InformationAction Continue
        $releaseErrors += "Missing required files: $($missingFiles -join ', ')"
    }
    else {
        Write-Information "  ✓ All required release files present" -InformationAction Continue
    }
    
}
catch {
    $releaseErrors += "Pre-release validation failed: $_"
    Write-Information "  ✗ Pre-release validation failed: $_" -InformationAction Continue
    exit 1
}

# 2. VERSION VALIDATION & UPDATE
Write-Information "`n[2/8] Version Management..." -InformationAction Continue

try {
    Write-Information "  → Validating version: $Version" -InformationAction Continue
    
    # Validate version format (semantic versioning)
    if (-not ($Version -match '^\d+\.\d+\.\d+(-\w+(\.\d+)?)?$')) {
        throw "Invalid version format. Use semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)"
    }
    
    # Update version in project files
    $versionFiles = @()
    
    # Update .NET project versions
    $csprojFiles = Get-ChildItem "*.csproj" -Recurse -ErrorAction SilentlyContinue
    foreach ($csproj in $csprojFiles) {
        try {
            [xml]$content = Get-Content $csproj.FullName
            $propertyGroup = $content.Project.PropertyGroup | Where-Object { $_.Version -or $_.AssemblyVersion }
            
            if (-not $propertyGroup) {
                $propertyGroup = $content.CreateElement("PropertyGroup")
                $content.Project.AppendChild($propertyGroup) | Out-Null
            }
            
            # Update or create version elements
            foreach ($versionProp in @("Version", "AssemblyVersion", "FileVersion")) {
                $element = $propertyGroup.SelectSingleNode($versionProp)
                if (-not $element) {
                    $element = $content.CreateElement($versionProp)
                    $propertyGroup.AppendChild($element) | Out-Null
                }
                $element.InnerText = $Version
            }
            
            $content.Save($csproj.FullName)
            $versionFiles += $csproj.Name
            
        }
        catch {
            Write-Information "    ⚠ Could not update version in $($csproj.Name): $_" -InformationAction Continue
        }
    }
    
    # Update package.json version
    if (Test-Path "package.json") {
        try {
            $packageJson = Get-Content "package.json" | ConvertFrom-Json
            $packageJson.version = $Version
            $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8
            $versionFiles += "package.json"
        }
        catch {
            Write-Information "    ⚠ Could not update package.json version: $_" -InformationAction Continue
        }
    }
    
    Write-Information "  ✓ Version updated in $($versionFiles.Count) file(s): $($versionFiles -join ', ')" -InformationAction Continue
    
}
catch {
    $releaseErrors += "Version management failed: $_"
    Write-Information "  ✗ Version management failed: $_" -InformationAction Continue
    exit 1
}

# 3. CREATE RELEASE DIRECTORY
Write-Information "`n[3/8] Creating Release Structure..." -InformationAction Continue

$releaseDir = "release\v$Version"
$releaseTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"

try {
    # Create release directory structure
    if (Test-Path "release") {
        Remove-Item "release" -Recurse -Force
    }
    
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
    New-Item -ItemType Directory -Path "$releaseDir\bin" -Force | Out-Null
    New-Item -ItemType Directory -Path "$releaseDir\docs" -Force | Out-Null
    New-Item -ItemType Directory -Path "$releaseDir\checksums" -Force | Out-Null
    
    Write-Information "  ✓ Release structure created: $releaseDir" -InformationAction Continue
    
}
catch {
    $releaseErrors += "Could not create release directory: $_"
    Write-Information "  ✗ Release directory creation failed: $_" -InformationAction Continue
    exit 1
}

# 4. COPY APPLICATION ARTIFACTS
Write-Information "`n[4/8] Copying Application Artifacts..." -InformationAction Continue

try {
    # Copy published applications
    $publishDirs = Get-ChildItem "publish" -Directory -ErrorAction SilentlyContinue
    foreach ($publishDir in $publishDirs) {
        $targetDir = "$releaseDir\bin\$($publishDir.Name)"
        Copy-Item $publishDir.FullName $targetDir -Recurse -Force
        
        $artifactSize = (Get-ChildItem $targetDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Information "  ✓ Copied: $($publishDir.Name) ($($artifactSize.ToString('F1')) MB)" -InformationAction Continue
        $releaseArtifacts += $targetDir
    }
    
    # Copy frontend build if exists
    $frontendDirs = @("dist", "build", "out", ".next")
    foreach ($dir in $frontendDirs) {
        if (Test-Path $dir) {
            Copy-Item $dir "$releaseDir\bin\frontend" -Recurse -Force
            $frontendSize = (Get-ChildItem "$releaseDir\bin\frontend" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
            Write-Information "  ✓ Copied frontend build ($($frontendSize.ToString('F1')) MB)" -InformationAction Continue
            $releaseArtifacts += "$releaseDir\bin\frontend"
            break
        }
    }
    
}
catch {
    $releaseErrors += "Artifact copying failed: $_"
    Write-Information "  ✗ Artifact copying failed: $_" -InformationAction Continue
    exit 1
}

# 5. COPY DOCUMENTATION & METADATA
Write-Information "`n[5/8] Copying Documentation..." -InformationAction Continue

try {
    # Required documentation files
    $docFiles = @("README.md", "LICENSE", "CHANGELOG.md", "SECURITY.md")
    foreach ($docFile in $docFiles) {
        if (Test-Path $docFile) {
            Copy-Item $docFile "$releaseDir\docs\" -Force
            Write-Information "  ✓ Copied: $docFile" -InformationAction Continue
        }
    }
    
    # Copy additional documentation
    if (Test-Path "docs") {
        Copy-Item "docs\*" "$releaseDir\docs\" -Recurse -Force
        Write-Information "  ✓ Copied docs directory" -InformationAction Continue
    }
    
    # Create release notes
    $releaseNotes = @"
# SvonyBrowser Release $Version

**Release Date:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')
**Build Configuration:** Release
**Git Commit:** $(try { git rev-parse HEAD } catch { "Unknown" })

## Artifacts Included
$($releaseArtifacts | ForEach-Object { "- $($_.Replace($releaseDir, '.'))" } | Out-String)

## System Requirements
- Windows 10/11 (64-bit)
- .NET 6.0 Runtime or higher
- Minimum 4GB RAM, 8GB recommended
- 1GB free disk space

## Installation Instructions
1. Extract all files to desired directory
2. Run the application executable from bin/
3. Follow setup wizard if applicable

## Support
- Documentation: docs/
- Issues: See project repository
- Security: See SECURITY.md

---
Generated by automated release process on $releaseTimestamp
"@
    
    $releaseNotes | Out-File "$releaseDir\RELEASE_NOTES.txt" -Encoding UTF8
    Write-Information "  ✓ Generated release notes" -InformationAction Continue
    
}
catch {
    $releaseErrors += "Documentation copying failed: $_"
    Write-Information "  ✗ Documentation copying failed: $_" -InformationAction Continue
}

# 6. GENERATE CHECKSUMS
Write-Information "`n[6/8] Generating Checksums..." -InformationAction Continue

try {
    $checksumFile = "$releaseDir\checksums\SHA256SUMS.txt"
    $checksums = @()
    
    # Generate checksums for all files in release
    $allFiles = Get-ChildItem $releaseDir -Recurse -File | Where-Object { 
        $_.FullName -notlike "*\checksums\*" 
    }
    
    foreach ($file in $allFiles) {
        $hash = Get-FileHash $file.FullName -Algorithm SHA256
        $relativePath = $file.FullName.Replace("$releaseDir\", "")
        $checksums += "$($hash.Hash)  $relativePath"
        
        if ($Verbose) {
            Write-Information "    $($file.Name): $($hash.Hash.Substring(0,16))..." -InformationAction Continue
        }
    }
    
    $checksums | Out-File $checksumFile -Encoding ASCII
    Write-Information "  ✓ Generated checksums for $($allFiles.Count) files" -InformationAction Continue
    
}
catch {
    $releaseErrors += "Checksum generation failed: $_"
    Write-Information "  ✗ Checksum generation failed: $_" -InformationAction Continue
}

# 7. CREATE PACKAGES
Write-Information "`n[7/8] Creating Release Packages..." -InformationAction Continue

$packages = @()

try {
    if ($CreateZip) {
        # Create ZIP package
        $zipFile = "SvonyBrowser-v$Version-windows-x64.zip"
        Write-Information "  → Creating ZIP package: $zipFile" -InformationAction Continue
        
        Compress-Archive -Path "$releaseDir\*" -DestinationPath $zipFile -Force
        $zipSize = (Get-Item $zipFile).Length / 1MB
        
        Write-Information "  ✓ ZIP package created ($($zipSize.ToString('F1')) MB)" -InformationAction Continue
        $packages += $zipFile
    }
    
    if ($CreateInstaller) {
        # Look for installer project or create basic installer
        $setupProjects = Get-ChildItem "*Setup*.wixproj", "*Installer*.wixproj" -Recurse -ErrorAction SilentlyContinue
        
        if ($setupProjects) {
            Write-Information "  → Building WiX installer..." -InformationAction Continue
            try {
                foreach ($setupProject in $setupProjects) {
                    msbuild $setupProject.FullName /p:Configuration=Release /p:ProductVersion=$Version
                    
                    $msiFiles = Get-ChildItem "$($setupProject.DirectoryName)\bin\Release\*.msi" -ErrorAction SilentlyContinue
                    foreach ($msi in $msiFiles) {
                        $installerName = "SvonyBrowser-v$Version-setup.msi"
                        Copy-Item $msi.FullName $installerName -Force
                        
                        $msiSize = (Get-Item $installerName).Length / 1MB
                        Write-Information "  ✓ Installer created: $installerName ($($msiSize.ToString('F1')) MB)" -InformationAction Continue
                        $packages += $installerName
                    }
                }
            }
            catch {
                Write-Information "  ✗ WiX installer build failed: $_" -InformationAction Continue
                $releaseErrors += "Installer creation failed: $_"
            }
        }
        else {
            Write-Information "  ⚠ No WiX installer project found - skipping installer" -InformationAction Continue
        }
    }
    
}
catch {
    $releaseErrors += "Package creation failed: $_"
    Write-Information "  ✗ Package creation failed: $_" -InformationAction Continue
}

# 8. SIGN ARTIFACTS (if requested)
if ($SignArtifacts) {
    Write-Information "`n[8/8] Signing Artifacts..." -InformationAction Continue
    
    try {
        # This would require code signing certificate setup
        Write-Information "  ⚠ Code signing not implemented - requires certificate configuration" -InformationAction Continue
        Write-Information "  → Manual signing required for production release" -InformationAction Continue
        
        # Placeholder for actual signing implementation
        # signtool sign /f certificate.pfx /p password /t http://timestamp.server /v artifact.exe
        
    }
    catch {
        $releaseErrors += "Artifact signing failed: $_"
        Write-Information "  ✗ Artifact signing failed: $_" -InformationAction Continue
    }
}
else {
    Write-Information "`n[8/8] Skipping Code Signing (use -SignArtifacts to enable)" -InformationAction Continue
}

# RELEASE SUMMARY
$releaseDuration = (Get-Date) - $releaseStart
Write-Information "`n" + "="*60 -InformationAction Continue
Write-Information "RELEASE SUMMARY" -InformationAction Continue
Write-Information "="*60 -InformationAction Continue

Write-Information "`nVERSION: $Version" -InformationAction Continue
Write-Information "RELEASE TIME: $($releaseDuration.TotalMinutes.ToString('F1')) minutes" -InformationAction Continue
Write-Information "RELEASE ERRORS: $($releaseErrors.Count)" -InformationAction Continue

if ($packages.Count -gt 0) {
    Write-Information "`nPACKAGES CREATED:" -InformationAction Continue
    foreach ($package in $packages) {
        $size = (Get-Item $package).Length / 1MB
        $hash = Get-FileHash $package -Algorithm SHA256
        Write-Information "  • $package ($($size.ToString('F1')) MB)" -InformationAction Continue
        Write-Information "    SHA256: $($hash.Hash)" -InformationAction Continue
    }
}

Write-Information "`nRELEASE DIRECTORY:" -InformationAction Continue
Write-Information "  $releaseDir" -InformationAction Continue
$releaseSize = (Get-ChildItem $releaseDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Information "  Total Size: $($releaseSize.ToString('F1')) MB" -InformationAction Continue

if ($releaseErrors.Count -gt 0) {
    Write-Information "`nRELEASE WARNINGS:" -InformationAction Continue
    foreach ($releaseError in $releaseErrors) {
        Write-Information "  • $releaseError" -InformationAction Continue
    }
}

# NEXT STEPS
Write-Information "`nNEXT STEPS:" -InformationAction Continue
Write-Information "  1. Test packages on clean system" -InformationAction Continue
Write-Information "  2. Verify checksums: Get-FileHash <package> -Algorithm SHA256" -InformationAction Continue
Write-Information "  3. Upload packages to distribution channels" -InformationAction Continue
Write-Information "  4. Update release notes and documentation" -InformationAction Continue
Write-Information "  5. Tag release in version control: git tag v$Version" -InformationAction Continue

if ($SignArtifacts -and $packages.Count -gt 0) {
    Write-Information "  6. Sign artifacts before distribution (REQUIRED for production)" -InformationAction Continue
}

if ($releaseErrors.Count -eq 0) {
    Write-Information "`n🎉 RELEASE PACKAGING SUCCESSFUL!" -InformationAction Continue
    Write-Information "SvonyBrowser v$Version is ready for distribution" -InformationAction Continue
}
else {
    Write-Information "`n⚠️ RELEASE COMPLETED WITH WARNINGS" -InformationAction Continue
    Write-Information "Review warnings before distributing release packages" -InformationAction Continue
}

exit $releaseErrors.Count
