# Format Script - Apply Deterministic Formatting
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
param(
    [switch]$Check = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== SVONY BROWSER - CODE FORMATTING ===" -InformationAction Continue

$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

$formatResults = @()
$totalFiles = 0
$formattedFiles = 0
$errors = 0

# 1. .NET CODE FORMATTING
Write-Information "`n[1/5] .NET Code Formatting..." -InformationAction Continue

$solutionFiles = Get-ChildItem "*.sln" -ErrorAction SilentlyContinue
if ($solutionFiles) {
    foreach ($solution in $solutionFiles) {
        Write-Information "  → Processing solution: $($solution.Name)" -InformationAction Continue
        try {
            if ($Check) {
                # Verify formatting without making changes
                $result = dotnet format $solution.FullName --verify-no-changes --verbosity diagnostic
                if ($LASTEXITCODE -eq 0) {
                    Write-Information "  ✓ $($solution.Name): Already formatted" -InformationAction Continue
                    $formatResults += @{ File = $solution.Name; Type = ".NET"; Action = "Verified"; Status = "OK" }
                }
                else {
                    Write-Information "  ⚠ $($solution.Name): Needs formatting" -InformationAction Continue
                    $formatResults += @{ File = $solution.Name; Type = ".NET"; Action = "Check"; Status = "NEEDS_FORMAT" }
                    $formattedFiles++
                }
            }
            else {
                # Apply formatting
                dotnet format $solution.FullName --verbosity diagnostic
                if ($LASTEXITCODE -eq 0) {
                    Write-Information "  ✓ $($solution.Name): Formatted" -InformationAction Continue
                    $formatResults += @{ File = $solution.Name; Type = ".NET"; Action = "Formatted"; Status = "OK" }
                    $formattedFiles++
                }
                else {
                    Write-Information "  ✗ $($solution.Name): Format failed" -InformationAction Continue
                    $formatResults += @{ File = $solution.Name; Type = ".NET"; Action = "Format"; Status = "ERROR" }
                    $errors++
                }
            }
            $totalFiles++
        }
        catch {
            Write-Information "  ✗ $($solution.Name): Exception ($_)" -InformationAction Continue
            $formatResults += @{ File = $solution.Name; Type = ".NET"; Action = "Format"; Status = "ERROR" }
            $errors++
            $totalFiles++
        }
    }
}
else {
    Write-Information "  ℹ No .NET solution files found" -InformationAction Continue
}

# 2. JAVASCRIPT/TYPESCRIPT FORMATTING
Write-Information "`n[2/5] JavaScript/TypeScript Formatting..." -InformationAction Continue

if (Test-Path "package.json") {
    # Check for Prettier configuration
    $prettierConfigs = @(".prettierrc", ".prettierrc.json", ".prettierrc.js", "prettier.config.js")
    $prettierConfigExists = $prettierConfigs | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if (-not $prettierConfigExists) {
        Write-Information "  → Creating default Prettier configuration..." -InformationAction Continue
        $prettierConfig = @{
            semi          = $true
            singleQuote   = $true
            tabWidth      = 2
            trailingComma = "es5"
            printWidth    = 80
            endOfLine     = "crlf"
        } | ConvertTo-Json -Depth 2
        
        $prettierConfig | Out-File ".prettierrc.json" -Encoding UTF8
        Write-Information "  ✓ Created .prettierrc.json" -InformationAction Continue
    }
    
    # Find JS/TS files to format
    $jsFiles = Get-ChildItem -Recurse -Include "*.js", "*.jsx", "*.ts", "*.tsx" -Exclude "node_modules", "dist", "build" -ErrorAction SilentlyContinue
    
    if ($jsFiles) {
        Write-Information "  → Processing $($jsFiles.Count) JavaScript/TypeScript files..." -InformationAction Continue
        
        try {
            # Install prettier if not available
            $prettierInstalled = npm list prettier --depth=0 2>$null
            if (-not $prettierInstalled) {
                Write-Information "  → Installing Prettier..." -InformationAction Continue
                npm install --save-dev prettier --silent
            }
            
            if ($Check) {
                # Check formatting
                npx prettier --check "**/*.{js,jsx,ts,tsx}" --ignore-path .gitignore
                if ($LASTEXITCODE -eq 0) {
                    Write-Information "  ✓ All JS/TS files properly formatted" -InformationAction Continue
                    $formatResults += @{ File = "JS/TS Files"; Type = "JavaScript"; Action = "Verified"; Status = "OK" }
                }
                else {
                    Write-Information "  ⚠ Some JS/TS files need formatting" -InformationAction Continue
                    $formatResults += @{ File = "JS/TS Files"; Type = "JavaScript"; Action = "Check"; Status = "NEEDS_FORMAT" }
                    $formattedFiles++
                }
            }
            else {
                # Apply formatting
                npx prettier --write "**/*.{js,jsx,ts,tsx}" --ignore-path .gitignore
                if ($LASTEXITCODE -eq 0) {
                    Write-Information "  ✓ Formatted $($jsFiles.Count) JS/TS files" -InformationAction Continue
                    $formatResults += @{ File = "$($jsFiles.Count) JS/TS Files"; Type = "JavaScript"; Action = "Formatted"; Status = "OK" }
                    $formattedFiles++
                }
                else {
                    Write-Information "  ✗ JS/TS formatting failed" -InformationAction Continue
                    $formatResults += @{ File = "JS/TS Files"; Type = "JavaScript"; Action = "Format"; Status = "ERROR" }
                    $errors++
                }
            }
            $totalFiles++
        }
        catch {
            Write-Information "  ✗ JS/TS formatting error: $_" -InformationAction Continue
            $formatResults += @{ File = "JS/TS Files"; Type = "JavaScript"; Action = "Format"; Status = "ERROR" }
            $errors++
            $totalFiles++
        }
    }
    else {
        Write-Information "  ℹ No JavaScript/TypeScript files found" -InformationAction Continue
    }
}
else {
    Write-Information "  ℹ No package.json found - skipping JS/TS formatting" -InformationAction Continue
}

# 3. POWERSHELL FORMATTING
Write-Information "`n[3/5] PowerShell Formatting..." -InformationAction Continue

$psFiles = Get-ChildItem -Recurse -Include "*.ps1", "*.psm1" -ErrorAction SilentlyContinue
if ($psFiles) {
    Write-Information "  → Processing $($psFiles.Count) PowerShell files..." -InformationAction Continue
    
    try {
        # Check if PSScriptAnalyzer is available
        $psaInstalled = Get-Module -ListAvailable PSScriptAnalyzer -ErrorAction SilentlyContinue
        if (-not $psaInstalled) {
            Write-Information "  → Installing PSScriptAnalyzer..." -InformationAction Continue
            Install-Module -Name PSScriptAnalyzer -Force -Scope CurrentUser
        }
        
        $psFormattedCount = 0
        foreach ($psFile in $psFiles) {
            try {
                if ($Check) {
                    # Check formatting (PSScriptAnalyzer doesn't have a format checker, so we simulate)
                    $content = Get-Content $psFile.FullName -Raw
                    $formatted = Invoke-Formatter -ScriptDefinition $content
                    
                    if ($content -eq $formatted) {
                        if ($Verbose) { Write-Information "    ✓ $($psFile.Name): Already formatted" -InformationAction Continue }
                    }
                    else {
                        Write-Information "    ⚠ $($psFile.Name): Needs formatting" -InformationAction Continue
                        $formattedFiles++
                    }
                }
                else {
                    # Apply formatting
                    $content = Get-Content $psFile.FullName -Raw
                    $formatted = Invoke-Formatter -ScriptDefinition $content
                    
                    if ($content -ne $formatted) {
                        $formatted | Set-Content $psFile.FullName -Encoding UTF8
                        if ($Verbose) { Write-Information "    ✓ $($psFile.Name): Formatted" -InformationAction Continue }
                        $psFormattedCount++
                    }
                    else {
                        if ($Verbose) { Write-Information "    ✓ $($psFile.Name): No changes needed" -InformationAction Continue }
                    }
                }
            }
            catch {
                Write-Information "    ✗ $($psFile.Name): Format error ($_)" -InformationAction Continue
                $errors++
            }
        }
        
        Write-Information "  ✓ Processed $($psFiles.Count) PowerShell files ($psFormattedCount modified)" -InformationAction Continue
        $formatResults += @{ File = "$($psFiles.Count) PS1 Files"; Type = "PowerShell"; Action = if ($Check) { "Checked" }else { "Formatted" }; Status = "OK" }
        $totalFiles++
        
    }
    catch {
        Write-Information "  ✗ PowerShell formatting error: $_" -InformationAction Continue
        $formatResults += @{ File = "PS1 Files"; Type = "PowerShell"; Action = "Format"; Status = "ERROR" }
        $errors++
        $totalFiles++
    }
}
else {
    Write-Information "  ℹ No PowerShell files found" -InformationAction Continue
}

# 4. CSS/SCSS FORMATTING
Write-Information "`n[4/5] CSS/SCSS Formatting..." -InformationAction Continue

$cssFiles = Get-ChildItem -Recurse -Include "*.css", "*.scss", "*.sass" -Exclude "node_modules", "dist", "build" -ErrorAction SilentlyContinue
if ($cssFiles -and (Test-Path "package.json")) {
    Write-Information "  → Processing $($cssFiles.Count) CSS/SCSS files..." -InformationAction Continue
    
    try {
        if ($Check) {
            npx prettier --check "**/*.{css,scss,sass}" --ignore-path .gitignore
            if ($LASTEXITCODE -eq 0) {
                Write-Information "  ✓ All CSS/SCSS files properly formatted" -InformationAction Continue
                $formatResults += @{ File = "CSS/SCSS Files"; Type = "CSS"; Action = "Verified"; Status = "OK" }
            }
            else {
                Write-Information "  ⚠ Some CSS/SCSS files need formatting" -InformationAction Continue
                $formatResults += @{ File = "CSS/SCSS Files"; Type = "CSS"; Action = "Check"; Status = "NEEDS_FORMAT" }
                $formattedFiles++
            }
        }
        else {
            npx prettier --write "**/*.{css,scss,sass}" --ignore-path .gitignore
            if ($LASTEXITCODE -eq 0) {
                Write-Information "  ✓ Formatted $($cssFiles.Count) CSS/SCSS files" -InformationAction Continue
                $formatResults += @{ File = "$($cssFiles.Count) CSS/SCSS Files"; Type = "CSS"; Action = "Formatted"; Status = "OK" }
                $formattedFiles++
            }
            else {
                Write-Information "  ✗ CSS/SCSS formatting failed" -InformationAction Continue
                $formatResults += @{ File = "CSS/SCSS Files"; Type = "CSS"; Action = "Format"; Status = "ERROR" }
                $errors++
            }
        }
        $totalFiles++
    }
    catch {
        Write-Information "  ✗ CSS/SCSS formatting error: $_" -InformationAction Continue
        $formatResults += @{ File = "CSS/SCSS Files"; Type = "CSS"; Action = "Format"; Status = "ERROR" }
        $errors++
        $totalFiles++
    }
}
elseif ($cssFiles) {
    Write-Information "  ℹ CSS files found but no package.json - skipping" -InformationAction Continue
}
else {
    Write-Information "  ℹ No CSS/SCSS files found" -InformationAction Continue
}

# 5. MARKDOWN FORMATTING
Write-Information "`n[5/5] Markdown Formatting..." -InformationAction Continue

$mdFiles = Get-ChildItem -Recurse -Include "*.md" -Exclude "node_modules" -ErrorAction SilentlyContinue
if ($mdFiles -and (Test-Path "package.json")) {
    Write-Information "  → Processing $($mdFiles.Count) Markdown files..." -InformationAction Continue
    
    try {
        if ($Check) {
            npx prettier --check "**/*.md" --ignore-path .gitignore
            if ($LASTEXITCODE -eq 0) {
                Write-Information "  ✓ All Markdown files properly formatted" -InformationAction Continue
                $formatResults += @{ File = "Markdown Files"; Type = "Markdown"; Action = "Verified"; Status = "OK" }
            }
            else {
                Write-Information "  ⚠ Some Markdown files need formatting" -InformationAction Continue
                $formatResults += @{ File = "Markdown Files"; Type = "Markdown"; Action = "Check"; Status = "NEEDS_FORMAT" }
                $formattedFiles++
            }
        }
        else {
            npx prettier --write "**/*.md" --ignore-path .gitignore
            if ($LASTEXITCODE -eq 0) {
                Write-Information "  ✓ Formatted $($mdFiles.Count) Markdown files" -InformationAction Continue
                $formatResults += @{ File = "$($mdFiles.Count) Markdown Files"; Type = "Markdown"; Action = "Formatted"; Status = "OK" }
                $formattedFiles++
            }
            else {
                Write-Information "  ✗ Markdown formatting failed" -InformationAction Continue
                $formatResults += @{ File = "Markdown Files"; Type = "Markdown"; Action = "Format"; Status = "ERROR" }
                $errors++
            }
        }
        $totalFiles++
    }
    catch {
        Write-Information "  ✗ Markdown formatting error: $_" -InformationAction Continue
        $formatResults += @{ File = "Markdown Files"; Type = "Markdown"; Action = "Format"; Status = "ERROR" }
        $errors++
        $totalFiles++
    }
}
else {
    Write-Information "  ℹ No Markdown files found or no package.json" -InformationAction Continue
}

# FORMAT SUMMARY
Write-Information "`n" + "="*60 -InformationAction Continue
Write-Information "FORMAT SUMMARY" -InformationAction Continue
Write-Information "="*60 -InformationAction Continue

Write-Information "`nFILE GROUPS PROCESSED: $totalFiles" -InformationAction Continue
Write-Information "FORMATTED/CHECKED: $formattedFiles" -InformationAction Continue
Write-Information "ERRORS: $errors" -InformationAction Continue

if ($Verbose -and $formatResults.Count -gt 0) {
    Write-Information "`nDETAILED RESULTS:" -InformationAction Continue
    foreach ($result in $formatResults) {
        Write-Information "  [$($result.Type)] $($result.File): $($result.Status)" -InformationAction Continue
    }
}

# RECOMMENDATIONS
if ($Check) {
    if ($formattedFiles -eq 0 -and $errors -eq 0) {
        Write-Information "`n✅ All files are properly formatted!" -InformationAction Continue
    }
    elseif ($formattedFiles -gt 0) {
        Write-Information "`n📝 $formattedFiles file group(s) need formatting." -InformationAction Continue
        Write-Information "Run: .\scripts\format.ps1 (without -Check) to apply formatting" -InformationAction Continue
    }
}
else {
    if ($formattedFiles -gt 0 -and $errors -eq 0) {
        Write-Information "`n✨ Formatting applied successfully!" -InformationAction Continue
        Write-Information "Verify changes with: git diff" -InformationAction Continue
    }
    elseif ($errors -eq 0) {
        Write-Information "`n✅ All files were already properly formatted!" -InformationAction Continue
    }
}

if ($errors -gt 0) {
    Write-Information "`n🔧 Fix $errors formatting error(s) manually." -InformationAction Continue
    Write-Information "Run with -Verbose for detailed error information." -InformationAction Continue
}

Write-Information "`nNEXT STEPS:" -InformationAction Continue
Write-Information "  Check formatting: .\scripts\format.ps1 -Check" -InformationAction Continue
Write-Information "  Run linting: .\scripts\lint.ps1" -InformationAction Continue
Write-Information "  Verify changes: git status && git diff" -InformationAction Continue

exit $errors
