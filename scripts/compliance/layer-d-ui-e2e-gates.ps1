# Layer D - UI/E2E Gates (When UI Exists)
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 7 Layer D requirements
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [switch]$Headless,
    [switch]$CaptureEvidence,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== LAYER D: UI/E2E Gates Analysis ===" -InformationAction Continue
Write-Information "Project: $ProjectRoot" -InformationAction Continue

$issues = @()
$warnings = @()
$evidenceDir = "$ProjectRoot\test-evidence"

if ($CaptureEvidence -and -not (Test-Path $evidenceDir)) {
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
}

# 1. DETECT UI TECHNOLOGY
Write-Information "`n[1/4] UI Technology Detection..." -InformationAction Continue

$uiTechnologies = @{
    'WPF'      = { Test-Path "$ProjectRoot\**\*.xaml" }
    'Electron' = { (Test-Path "$ProjectRoot\package.json") -and ((Get-Content "$ProjectRoot\package.json" | ConvertFrom-Json).dependencies.electron -ne $null) }
    'React'    = { (Test-Path "$ProjectRoot\package.json") -and ((Get-Content "$ProjectRoot\package.json" | ConvertFrom-Json).dependencies.react -ne $null) }
    'Angular'  = { (Test-Path "$ProjectRoot\package.json") -and ((Get-Content "$ProjectRoot\package.json" | ConvertFrom-Json).dependencies."@angular/core" -ne $null) }
    'Blazor'   = { (Get-ChildItem "$ProjectRoot\**\*.razor" -Recurse -ErrorAction SilentlyContinue).Count -gt 0 }
    'Web'      = { (Get-ChildItem "$ProjectRoot\**\*.html" -Recurse -ErrorAction SilentlyContinue).Count -gt 0 }
}

$detectedTech = @()
foreach ($tech in $uiTechnologies.Keys) {
    if (& $uiTechnologies[$tech]) {
        $detectedTech += $tech
        Write-Information "  ✓ Detected: $tech" -InformationAction Continue
    }
}

if ($detectedTech.Count -eq 0) {
    Write-Information "  ℹ No UI technology detected - skipping Layer D" -InformationAction Continue
    exit 0
}

# 2. SETUP TEST FRAMEWORK
Write-Information "`n[2/4] Test Framework Setup..." -InformationAction Continue

$testFramework = $null
$testCommand = $null

foreach ($tech in $detectedTech) {
    switch ($tech) {
        'WPF' {
            # Check for FlaUI
            if ((Get-ChildItem "$ProjectRoot\**\*FlaUI*.dll" -Recurse -ErrorAction SilentlyContinue) -or 
                (Test-Path "$ProjectRoot\packages.config" -and (Get-Content "$ProjectRoot\packages.config" | Select-String "FlaUI"))) {
                $testFramework = 'FlaUI'
                $testCommand = { dotnet test --logger trx --results-directory $evidenceDir }
                Write-Information "  ✓ FlaUI framework detected" -InformationAction Continue
            }
            else {
                $warnings += "WPF project detected but no FlaUI test framework found"
                Write-Information "  ⚠ No WPF test framework" -InformationAction Continue
            }
        }
        
        'Electron' {
            # Check for Playwright
            if (Test-Path "$ProjectRoot\playwright.config.js" -or Test-Path "$ProjectRoot\playwright.config.ts") {
                $testFramework = 'Playwright'
                $testCommand = { npx playwright test --reporter=html --output-dir=$evidenceDir }
                Write-Information "  ✓ Playwright framework detected" -InformationAction Continue
            }
            else {
                $warnings += "Electron project detected but no Playwright configuration found"
                Write-Information "  ⚠ No Electron test framework" -InformationAction Continue
            }
        }
        
        'React' {
            if (Test-Path "$ProjectRoot\playwright.config.js" -or Test-Path "$ProjectRoot\cypress.config.js") {
                $testFramework = if (Test-Path "$ProjectRoot\playwright.config.js") { 'Playwright' } else { 'Cypress' }
                $testCommand = if ($testFramework -eq 'Playwright') { 
                    { npx playwright test --reporter=html --output-dir=$evidenceDir }
                }
                else {
                    { npx cypress run --reporter junit --reporter-options mochaFile=$evidenceDir\results.xml }
                }
                Write-Information "  ✓ $testFramework framework detected" -InformationAction Continue
            }
            else {
                $warnings += "React project detected but no E2E test framework found"
                Write-Information "  ⚠ No React E2E framework" -InformationAction Continue
            }
        }
        
        'Web' {
            if (Test-Path "$ProjectRoot\playwright.config.js") {
                $testFramework = 'Playwright'
                $testCommand = { npx playwright test --reporter=html --output-dir=$evidenceDir }
                Write-Information "  ✓ Playwright framework detected" -InformationAction Continue
            }
            else {
                Write-Information "  ℹ Web project - manual E2E test setup recommended" -InformationAction Continue
            }
        }
    }
    
    if ($testFramework) { break }
}

# 3. RUN E2E TESTS
Write-Information "`n[3/4] E2E Test Execution..." -InformationAction Continue

if ($testCommand) {
    try {
        Write-Information "  → Running $testFramework tests..." -InformationAction Continue
        
        # Set environment for headless execution
        if ($Headless) {
            $env:HEADLESS = "true"
            $env:PLAYWRIGHT_HEADLESS = "true"
        }
        
        # Execute tests with evidence capture
        $testStart = Get-Date
        & $testCommand
        $testDuration = (Get-Date) - $testStart
        
        if ($LASTEXITCODE -eq 0) {
            Write-Information "  ✓ E2E tests PASS ($($testDuration.TotalSeconds.ToString('F1'))s)" -InformationAction Continue
        }
        else {
            $issues += "E2E tests failed - see evidence directory for details"
            Write-Information "  ✗ E2E tests FAIL ($($testDuration.TotalSeconds.ToString('F1'))s)" -InformationAction Continue
        }
        
    }
    catch {
        $issues += "E2E test execution failed: $_"
        Write-Information "  ✗ E2E execution FAIL" -InformationAction Continue
    }
}
else {
    $warnings += "No E2E test framework configured"
    Write-Information "  ⚠ No E2E tests to run" -InformationAction Continue
}

# 4. EVIDENCE COLLECTION & ANALYSIS
Write-Information "`n[4/4] Evidence Collection..." -InformationAction Continue

if ($CaptureEvidence) {
    $evidenceFiles = Get-ChildItem $evidenceDir -Recurse -ErrorAction SilentlyContinue
    
    if ($evidenceFiles) {
        Write-Information "  Evidence collected in: $evidenceDir" -InformationAction Continue
        
        # Analyze evidence files
        $screenshots = $evidenceFiles | Where-Object { $_.Extension -in @('.png', '.jpg', '.jpeg') }
        $videos = $evidenceFiles | Where-Object { $_.Extension -in @('.mp4', '.webm') }
        $traces = $evidenceFiles | Where-Object { $_.Name -like "*trace*" }
        $reports = $evidenceFiles | Where-Object { $_.Extension -in @('.html', '.xml', '.json') }
        
        Write-Information "    Screenshots: $($screenshots.Count)" -InformationAction Continue
        Write-Information "    Videos: $($videos.Count)" -InformationAction Continue
        Write-Information "    Traces: $($traces.Count)" -InformationAction Continue
        Write-Information "    Reports: $($reports.Count)" -InformationAction Continue
        
        # Check for failure evidence
        $failureEvidence = $evidenceFiles | Where-Object { 
            $_.Name -like "*fail*" -or $_.Name -like "*error*" -or $_.Name -like "*timeout*"
        }
        
        if ($failureEvidence) {
            Write-Information "  ⚠ Failure evidence found: $($failureEvidence.Count) files" -InformationAction Continue
            foreach ($file in $failureEvidence | Select-Object -First 3) {
                Write-Information "    • $($file.Name)" -InformationAction Continue
            }
            if ($failureEvidence.Count -gt 3) {
                Write-Information "    • ... and $($failureEvidence.Count - 3) more" -InformationAction Continue
            }
        }
        else {
            Write-Information "  ✓ No failure evidence" -InformationAction Continue
        }
        
    }
    else {
        Write-Information "  ℹ No evidence files generated" -InformationAction Continue
    }
}

# 5. UI COMPONENT VALIDATION
Write-Information "`n[5/5] UI Component Validation..." -InformationAction Continue

# Validate common UI patterns
foreach ($tech in $detectedTech) {
    switch ($tech) {
        'WPF' {
            # Check for proper XAML binding and resource usage
            $xamlFiles = Get-ChildItem "$ProjectRoot\**\*.xaml" -Recurse -ErrorAction SilentlyContinue
            $bindingIssues = 0
            
            foreach ($xamlFile in $xamlFiles) {
                $content = Get-Content $xamlFile.FullName -Raw
                
                # Check for unbound UI elements that should be bound
                if ($content -match '<Button[^>]*Click="[^"]*"' -and $content -notmatch 'Command=') {
                    $bindingIssues++
                }
                
                # Check for missing resource references
                if ($content -match 'StaticResource\s+(\w+)') {
                    # This would need more sophisticated validation
                }
            }
            
            if ($bindingIssues -eq 0) {
                Write-Information "  ✓ XAML binding patterns OK" -InformationAction Continue
            }
            else {
                $warnings += "$bindingIssues potential XAML binding issues found"
                Write-Information "  ⚠ XAML binding issues ($bindingIssues)" -InformationAction Continue
            }
        }
        
        'React' {
            # Check for proper React patterns
            $jsxFiles = Get-ChildItem "$ProjectRoot\src\**\*.jsx" -Recurse -ErrorAction SilentlyContinue
            $tsxFiles = Get-ChildItem "$ProjectRoot\src\**\*.tsx" -Recurse -ErrorAction SilentlyContinue
            
            $reactIssues = 0
            foreach ($file in ($jsxFiles + $tsxFiles)) {
                $content = Get-Content $file.FullName -Raw
                
                # Check for unhandled click events
                if ($content -match 'onClick=\{[^}]*console\.log' -or $content -match 'onClick=\{\(\)\s*=>\s*\{\s*\}\s*\}') {
                    $reactIssues++
                }
            }
            
            if ($reactIssues -eq 0) {
                Write-Information "  ✓ React component patterns OK" -InformationAction Continue
            }
            else {
                $warnings += "$reactIssues potential React component issues found"
                Write-Information "  ⚠ React component issues ($reactIssues)" -InformationAction Continue
            }
        }
        
        'Web' {
            # Check for basic HTML/CSS validation
            $htmlFiles = Get-ChildItem "$ProjectRoot\**\*.html" -Recurse -ErrorAction SilentlyContinue
            $htmlIssues = 0
            
            foreach ($htmlFile in $htmlFiles) {
                $content = Get-Content $htmlFile.FullName -Raw
                
                # Check for missing alt attributes on images
                if ($content -match '<img(?![^>]*alt=)') {
                    $htmlIssues++
                }
                
                # Check for onclick handlers without proper event handling
                if ($content -match 'onclick="[^"]*"' -and $content -notmatch 'event\.preventDefault') {
                    $htmlIssues++
                }
            }
            
            if ($htmlIssues -eq 0) {
                Write-Information "  ✓ HTML patterns OK" -InformationAction Continue
            }
            else {
                $warnings += "$htmlIssues potential HTML accessibility/event issues found"
                Write-Information "  ⚠ HTML pattern issues ($htmlIssues)" -InformationAction Continue
            }
        }
    }
}

# SUMMARY
Write-Information "`n=== LAYER D SUMMARY ===" -InformationAction Continue
Write-Information "UI Technologies: $($detectedTech -join ', ')" -InformationAction Continue
Write-Information "Test Framework: $($testFramework -or 'None')" -InformationAction Continue
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

if ($CaptureEvidence -and (Test-Path $evidenceDir)) {
    Write-Information "`nEvidence Directory: $evidenceDir" -InformationAction Continue
}

if ($Verbose) {
    Write-Information "`nNext: Run Layer E (Release Gates)" -InformationAction Continue
    Write-Information "Command: .\scripts\compliance\layer-e-release-gates.ps1" -InformationAction Continue
}

exit $issues.Count
