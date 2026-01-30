# Lint Script - Run Analyzers with Zero Warnings Policy
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
param(
    [switch]$Fix = $false,
    [switch]$WarningsAsErrors,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== SVONY BROWSER - LINTING & ANALYSIS ===" -InformationAction Continue

$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

$lintResults = @()
$totalIssues = 0
$warnings = 0
$errors = 0

# 1. .NET ANALYZERS
Write-Information "`n[1/6] .NET Analyzers..." -InformationAction Continue

$solutionFiles = Get-ChildItem "*.sln" -ErrorAction SilentlyContinue
if ($solutionFiles) {
    foreach ($solution in $solutionFiles) {
        Write-Information "  → Analyzing solution: $($solution.Name)" -InformationAction Continue
        try {
            # Build with analyzers and treat warnings as errors if configured
            $buildArgs = @("build", $solution.FullName, "--no-restore", "--verbosity", "normal")
            
            if ($WarningsAsErrors) {
                $buildArgs += "/p:TreatWarningsAsErrors=true"
            }
            
            $buildOutput = & dotnet @buildArgs 2>&1
            $buildExitCode = $LASTEXITCODE
            
            if ($buildExitCode -eq 0) {
                Write-Information "  ✓ $($solution.Name): No issues found" -InformationAction Continue
                $lintResults += @{ File = $solution.Name; Type = ".NET"; Issues = 0; Status = "CLEAN" }
            }
            else {
                # Parse build output for warnings and errors
                $issueCount = 0
                $warningCount = 0
                $errorCount = 0
                
                foreach ($line in $buildOutput) {
                    if ($line -match "warning\s+(CS\d+|CA\d+|IDE\d+)") {
                        $warningCount++
                        if ($Verbose) { Write-Information "    ⚠ $line" -InformationAction Continue }
                    }
                    if ($line -match "error\s+(CS\d+|CA\d+|IDE\d+)") {
                        $errorCount++
                        if ($Verbose) { Write-Information "    ✗ $line" -InformationAction Continue }
                    }
                }
                
                $issueCount = $warningCount + $errorCount
                $totalIssues += $issueCount
                $warnings += $warningCount
                $errors += $errorCount
                
                Write-Information "  ✗ $($solution.Name): $issueCount issues ($warningCount warnings, $errorCount errors)" -InformationAction Continue
                $lintResults += @{ 
                    File     = $solution.Name; 
                    Type     = ".NET"; 
                    Issues   = $issueCount; 
                    Warnings = $warningCount;
                    Errors   = $errorCount;
                    Status   = "ISSUES" 
                }
            }
        }
        catch {
            Write-Information "  ✗ $($solution.Name): Analysis failed ($_)" -InformationAction Continue
            $lintResults += @{ File = $solution.Name; Type = ".NET"; Issues = 1; Status = "ERROR" }
            $errors++
            $totalIssues++
        }
    }
}
else {
    Write-Information "  ℹ No .NET solution files found" -InformationAction Continue
}

# 2. JAVASCRIPT/TYPESCRIPT LINTING
Write-Information "`n[2/6] JavaScript/TypeScript Linting..." -InformationAction Continue

if (Test-Path "package.json") {
    # Check for ESLint configuration
    $eslintConfigs = @(".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", "eslint.config.js")
    $eslintConfigExists = $eslintConfigs | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if (-not $eslintConfigExists) {
        Write-Information "  → Creating default ESLint configuration..." -InformationAction Continue
        $eslintConfig = @{
            env           = @{
                browser = $true
                node    = $true
                es2021  = $true
            }
            extends       = @("eslint:recommended", "@typescript-eslint/recommended")
            parser        = "@typescript-eslint/parser"
            parserOptions = @{
                ecmaVersion = 12
                sourceType  = "module"
            }
            plugins       = @("@typescript-eslint")
            rules         = @{
                "no-console"     = "warn"
                "no-unused-vars" = "error"
                "prefer-const"   = "error"
                "no-var"         = "error"
            }
        } | ConvertTo-Json -Depth 4
        
        $eslintConfig | Out-File ".eslintrc.json" -Encoding UTF8
        Write-Information "  ✓ Created .eslintrc.json" -InformationAction Continue
    }
    
    # Find JS/TS files to lint
    $jsFiles = Get-ChildItem -Recurse -Include "*.js", "*.jsx", "*.ts", "*.tsx" -Exclude "node_modules", "dist", "build" -ErrorAction SilentlyContinue
    
    if ($jsFiles) {
        Write-Information "  → Linting $($jsFiles.Count) JavaScript/TypeScript files..." -InformationAction Continue
        
        try {
            # Install ESLint if not available
            $eslintInstalled = npm list eslint --depth=0 2>$null
            if (-not $eslintInstalled) {
                Write-Information "  → Installing ESLint..." -InformationAction Continue
                npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin --silent
            }
            
            # Run ESLint
            $eslintArgs = @("eslint", "**/*.{js,jsx,ts,tsx}", "--format", "json")
            if ($Fix) {
                $eslintArgs += "--fix"
            }
            
            $eslintOutput = & npx @eslintArgs 2>&1
            $eslintExitCode = $LASTEXITCODE
            
            if ($eslintExitCode -eq 0) {
                Write-Information "  ✓ All JS/TS files pass linting" -InformationAction Continue
                $lintResults += @{ File = "JS/TS Files"; Type = "JavaScript"; Issues = 0; Status = "CLEAN" }
            }
            else {
                try {
                    $eslintJson = $eslintOutput | ConvertFrom-Json -ErrorAction SilentlyContinue
                    $jsIssues = 0
                    $jsWarnings = 0
                    $jsErrors = 0
                    
                    foreach ($fileResult in $eslintJson) {
                        $fileIssues = $fileResult.messages.Count
                        $fileWarnings = ($fileResult.messages | Where-Object { $_.severity -eq 1 }).Count
                        $fileErrors = ($fileResult.messages | Where-Object { $_.severity -eq 2 }).Count
                        
                        $jsIssues += $fileIssues
                        $jsWarnings += $fileWarnings  
                        $jsErrors += $fileErrors
                        
                        if ($Verbose -and $fileIssues -gt 0) {
                            Write-Information "    $($fileResult.filePath): $fileIssues issues" -InformationAction Continue
                        }
                    }
                    
                    $totalIssues += $jsIssues
                    $warnings += $jsWarnings
                    $errors += $jsErrors
                    
                    Write-Information "  ✗ JS/TS linting: $jsIssues issues ($jsWarnings warnings, $jsErrors errors)" -InformationAction Continue
                    $lintResults += @{ 
                        File     = "JS/TS Files"; 
                        Type     = "JavaScript"; 
                        Issues   = $jsIssues; 
                        Warnings = $jsWarnings;
                        Errors   = $jsErrors;
                        Status   = "ISSUES" 
                    }
                }
                catch {
                    Write-Information "  ✗ JS/TS linting failed (could not parse output)" -InformationAction Continue
                    $lintResults += @{ File = "JS/TS Files"; Type = "JavaScript"; Issues = 1; Status = "ERROR" }
                    $errors++
                    $totalIssues++
                }
            }
        }
        catch {
            Write-Information "  ✗ JS/TS linting error: $_" -InformationAction Continue
            $lintResults += @{ File = "JS/TS Files"; Type = "JavaScript"; Issues = 1; Status = "ERROR" }
            $errors++
            $totalIssues++
        }
    }
    else {
        Write-Information "  ℹ No JavaScript/TypeScript files found" -InformationAction Continue
    }
}
else {
    Write-Information "  ℹ No package.json found - skipping JS/TS linting" -InformationAction Continue
}

# 3. POWERSHELL ANALYSIS
Write-Information "`n[3/6] PowerShell Analysis..." -InformationAction Continue

$psFiles = Get-ChildItem -Recurse -Include "*.ps1", "*.psm1" -ErrorAction SilentlyContinue
if ($psFiles) {
    Write-Information "  → Analyzing $($psFiles.Count) PowerShell files..." -InformationAction Continue
    
    try {
        # Check if PSScriptAnalyzer is available
        $psaInstalled = Get-Module -ListAvailable PSScriptAnalyzer -ErrorAction SilentlyContinue
        if (-not $psaInstalled) {
            Write-Information "  → Installing PSScriptAnalyzer..." -InformationAction Continue
            Install-Module -Name PSScriptAnalyzer -Force -Scope CurrentUser
        }
        
        $psIssues = 0
        $psWarnings = 0 
        $psErrors = 0
        
        foreach ($psFile in $psFiles) {
            try {
                $analysis = Invoke-ScriptAnalyzer -Path $psFile.FullName -Severity Error, Warning, Information
                
                if ($analysis) {
                    $fileWarnings = ($analysis | Where-Object { $_.Severity -eq "Warning" }).Count
                    $fileErrors = ($analysis | Where-Object { $_.Severity -eq "Error" }).Count
                    $fileInfo = ($analysis | Where-Object { $_.Severity -eq "Information" }).Count
                    
                    $fileIssues = $fileWarnings + $fileErrors + $fileInfo
                    $psIssues += $fileIssues
                    $psWarnings += $fileWarnings
                    $psErrors += $fileErrors
                    
                    if ($Verbose -and $fileIssues -gt 0) {
                        Write-Information "    $($psFile.Name): $fileIssues issues ($fileWarnings warnings, $fileErrors errors)" -InformationAction Continue
                        foreach ($issue in $analysis) {
                            Write-Information "      [$($issue.Severity)] $($issue.RuleName): $($issue.Message)" -InformationAction Continue
                        }
                    }
                }
            }
            catch {
                Write-Information "    ✗ $($psFile.Name): Analysis error ($_)" -InformationAction Continue
                $psErrors++
                $psIssues++
            }
        }
        
        $totalIssues += $psIssues
        $warnings += $psWarnings
        $errors += $psErrors
        
        if ($psIssues -eq 0) {
            Write-Information "  ✓ All PowerShell files pass analysis" -InformationAction Continue
            $lintResults += @{ File = "PowerShell Files"; Type = "PowerShell"; Issues = 0; Status = "CLEAN" }
        }
        else {
            Write-Information "  ✗ PowerShell analysis: $psIssues issues ($psWarnings warnings, $psErrors errors)" -InformationAction Continue
            $lintResults += @{ 
                File     = "PowerShell Files"; 
                Type     = "PowerShell"; 
                Issues   = $psIssues; 
                Warnings = $psWarnings;
                Errors   = $psErrors;
                Status   = "ISSUES" 
            }
        }
    }
    catch {
        Write-Information "  ✗ PowerShell analysis error: $_" -InformationAction Continue
        $lintResults += @{ File = "PowerShell Files"; Type = "PowerShell"; Issues = 1; Status = "ERROR" }
        $errors++
        $totalIssues++
    }
}
else {
    Write-Information "  ℹ No PowerShell files found" -InformationAction Continue
}

# 4. CSS/SCSS LINTING
Write-Information "`n[4/6] CSS/SCSS Linting..." -InformationAction Continue

$cssFiles = Get-ChildItem -Recurse -Include "*.css", "*.scss", "*.sass" -Exclude "node_modules", "dist", "build" -ErrorAction SilentlyContinue
if ($cssFiles -and (Test-Path "package.json")) {
    Write-Information "  → Linting $($cssFiles.Count) CSS/SCSS files..." -InformationAction Continue
    
    try {
        # Install stylelint if not available
        $stylelintInstalled = npm list stylelint --depth=0 2>$null
        if (-not $stylelintInstalled) {
            Write-Information "  → Installing stylelint..." -InformationAction Continue
            npm install --save-dev stylelint stylelint-config-standard --silent
            
            # Create stylelint config if it doesn't exist
            if (-not (Test-Path ".stylelintrc.json")) {
                @{
                    extends = @("stylelint-config-standard")
                    rules   = @{
                        "color-hex-case"   = "lower"
                        "color-hex-length" = "short"
                        "indentation"      = 2
                    }
                } | ConvertTo-Json -Depth 3 | Out-File ".stylelintrc.json" -Encoding UTF8
            }
        }
        
        # Run stylelint
        $stylelintArgs = @("stylelint", "**/*.{css,scss,sass}", "--formatter", "json")
        if ($Fix) {
            $stylelintArgs += "--fix"
        }
        
        $stylelintOutput = & npx @stylelintArgs 2>&1
        $stylelintExitCode = $LASTEXITCODE
        
        if ($stylelintExitCode -eq 0) {
            Write-Information "  ✓ All CSS/SCSS files pass linting" -InformationAction Continue
            $lintResults += @{ File = "CSS/SCSS Files"; Type = "CSS"; Issues = 0; Status = "CLEAN" }
        }
        else {
            try {
                $stylelintJson = $stylelintOutput | ConvertFrom-Json -ErrorAction SilentlyContinue
                $cssIssues = 0
                $cssWarnings = 0
                $cssErrors = 0
                
                foreach ($fileResult in $stylelintJson) {
                    $fileIssues = $fileResult.warnings.Count
                    $fileWarnings = ($fileResult.warnings | Where-Object { $_.severity -eq "warning" }).Count
                    $fileErrors = ($fileResult.warnings | Where-Object { $_.severity -eq "error" }).Count
                    
                    $cssIssues += $fileIssues
                    $cssWarnings += $fileWarnings
                    $cssErrors += $fileErrors
                }
                
                $totalIssues += $cssIssues
                $warnings += $cssWarnings
                $errors += $cssErrors
                
                Write-Information "  ✗ CSS/SCSS linting: $cssIssues issues ($cssWarnings warnings, $cssErrors errors)" -InformationAction Continue
                $lintResults += @{ 
                    File     = "CSS/SCSS Files"; 
                    Type     = "CSS"; 
                    Issues   = $cssIssues; 
                    Warnings = $cssWarnings;
                    Errors   = $cssErrors;
                    Status   = "ISSUES" 
                }
            }
            catch {
                Write-Information "  ✗ CSS/SCSS linting failed (could not parse output)" -InformationAction Continue
                $lintResults += @{ File = "CSS/SCSS Files"; Type = "CSS"; Issues = 1; Status = "ERROR" }
                $errors++
                $totalIssues++
            }
        }
    }
    catch {
        Write-Information "  ✗ CSS/SCSS linting error: $_" -InformationAction Continue
        $lintResults += @{ File = "CSS/SCSS Files"; Type = "CSS"; Issues = 1; Status = "ERROR" }
        $errors++
        $totalIssues++
    }
}
else {
    Write-Information "  ℹ No CSS/SCSS files found or no package.json" -InformationAction Continue
}

# 5. MARKDOWN LINTING
Write-Information "`n[5/6] Markdown Linting..." -InformationAction Continue

$mdFiles = Get-ChildItem -Recurse -Include "*.md" -Exclude "node_modules" -ErrorAction SilentlyContinue
if ($mdFiles -and (Test-Path "package.json")) {
    Write-Information "  → Linting $($mdFiles.Count) Markdown files..." -InformationAction Continue
    
    try {
        # Install markdownlint if not available
        $markdownlintInstalled = npm list markdownlint-cli --depth=0 2>$null
        if (-not $markdownlintInstalled) {
            Write-Information "  → Installing markdownlint..." -InformationAction Continue
            npm install --save-dev markdownlint-cli --silent
        }
        
        # Run markdownlint
        $markdownlintArgs = @("markdownlint", "**/*.md", "--json")
        if ($Fix) {
            $markdownlintArgs += "--fix"
        }
        
        $markdownlintOutput = & npx @markdownlintArgs 2>&1
        $markdownlintExitCode = $LASTEXITCODE
        
        if ($markdownlintExitCode -eq 0) {
            Write-Information "  ✓ All Markdown files pass linting" -InformationAction Continue
            $lintResults += @{ File = "Markdown Files"; Type = "Markdown"; Issues = 0; Status = "CLEAN" }
        }
        else {
            # Count issues from output (markdownlint doesn't provide JSON in all cases)
            $mdIssueCount = ($markdownlintOutput | Where-Object { $_ -match "\.md:\d+:" }).Count
            
            if ($mdIssueCount -gt 0) {
                $totalIssues += $mdIssueCount
                $warnings += $mdIssueCount
                
                Write-Information "  ✗ Markdown linting: $mdIssueCount issues" -InformationAction Continue
                $lintResults += @{ 
                    File     = "Markdown Files"; 
                    Type     = "Markdown"; 
                    Issues   = $mdIssueCount; 
                    Warnings = $mdIssueCount;
                    Errors   = 0;
                    Status   = "ISSUES" 
                }
                
                if ($Verbose) {
                    foreach ($line in $markdownlintOutput | Select-Object -First 10) {
                        if ($line -match "\.md:\d+:") {
                            Write-Information "    ⚠ $line" -InformationAction Continue
                        }
                    }
                    if ($mdIssueCount -gt 10) {
                        Write-Information "    ... and $($mdIssueCount - 10) more issues" -InformationAction Continue
                    }
                }
            }
        }
    }
    catch {
        Write-Information "  ✗ Markdown linting error: $_" -InformationAction Continue
        $lintResults += @{ File = "Markdown Files"; Type = "Markdown"; Issues = 1; Status = "ERROR" }
        $errors++
        $totalIssues++
    }
}
else {
    Write-Information "  ℹ No Markdown files found or no package.json" -InformationAction Continue
}

# 6. WARNING ALLOWLIST VALIDATION
Write-Information "`n[6/6] Warning Allowlist Validation..." -InformationAction Continue

$allowlistPath = "$projectRoot\.warning-allowlist.yml"
if (Test-Path $allowlistPath) {
    Write-Information "  → Validating warning allowlist..." -InformationAction Continue
    try {
        # This requires PowerShell-Yaml module
        try {
            Import-Module PowerShell-Yaml -ErrorAction Stop
        }
        catch {
            Write-Information "  → Installing PowerShell-Yaml module..." -InformationAction Continue
            Install-Module PowerShell-Yaml -Force -Scope CurrentUser
            Import-Module PowerShell-Yaml
        }
        
        $allowlist = Get-Content $allowlistPath -Raw | ConvertFrom-Yaml
        $today = Get-Date
        $expiredRules = @()
        $totalRules = 0
        
        if ($allowlist.rules) {
            foreach ($rule in $allowlist.rules) {
                $totalRules++
                try {
                    $expiry = [datetime]$rule.expires
                    if ($expiry -lt $today) {
                        $expiredRules += "Rule $($rule.rule) in $($rule.path) expired on $($rule.expires)"
                    }
                }
                catch {
                    $expiredRules += "Rule $($rule.rule) has invalid expiry date: $($rule.expires)"
                }
            }
        }
        
        if ($expiredRules.Count -gt 0) {
            Write-Information "  ✗ $($expiredRules.Count) expired allowlist rules found" -InformationAction Continue
            $totalIssues += $expiredRules.Count
            $errors += $expiredRules.Count
            
            if ($Verbose) {
                foreach ($expired in $expiredRules) {
                    Write-Information "    ✗ $expired" -InformationAction Continue
                }
            }
        }
        elseif ($totalRules -gt 10) {
            Write-Information "  ⚠ Warning allowlist has $totalRules entries (limit: 10)" -InformationAction Continue
            $warnings++
            $totalIssues++
        }
        else {
            Write-Information "  ✓ Warning allowlist OK ($totalRules active rules)" -InformationAction Continue
        }
        
    }
    catch {
        Write-Information "  ⚠ Could not validate allowlist: $_" -InformationAction Continue
    }
}
else {
    Write-Information "  ✓ No warning allowlist (zero warnings policy active)" -InformationAction Continue
}

# LINTING SUMMARY
Write-Information "`n" + "="*60 -InformationAction Continue
Write-Information "LINTING SUMMARY" -InformationAction Continue
Write-Information "="*60 -InformationAction Continue

Write-Information "`nTOTAL ISSUES: $totalIssues" -InformationAction Continue
Write-Information "WARNINGS: $warnings" -InformationAction Continue
Write-Information "ERRORS: $errors" -InformationAction Continue

if ($Verbose -and $lintResults.Count -gt 0) {
    Write-Information "`nDETAILED RESULTS:" -InformationAction Continue
    foreach ($result in $lintResults) {
        Write-Information "  [$($result.Type)] $($result.File): $($result.Status)" -InformationAction Continue
        if ($result.Issues -gt 0) {
            Write-Information "    Issues: $($result.Issues)" -InformationAction Continue
        }
    }
}

# ZERO WARNINGS POLICY ENFORCEMENT
Write-Information "`n" + "="*60 -InformationAction Continue
if ($totalIssues -eq 0) {
    Write-Information "✅ ZERO WARNINGS POLICY: COMPLIANT" -InformationAction Continue
    Write-Information "All code passes linting with no issues!" -InformationAction Continue
}
else {
    Write-Information "❌ ZERO WARNINGS POLICY: VIOLATION" -InformationAction Continue
    Write-Information "Contract requires zero warnings - $totalIssues issues must be fixed" -InformationAction Continue
    
    Write-Information "`nRECOMMENDED ACTIONS:" -InformationAction Continue
    Write-Information "1. Fix automatic issues: .\scripts\lint.ps1 -Fix" -InformationAction Continue
    Write-Information "2. Review remaining issues manually" -InformationAction Continue
    Write-Information "3. Add justified issues to .warning-allowlist.yml (sparingly)" -InformationAction Continue
    Write-Information "4. Re-run linting until zero issues achieved" -InformationAction Continue
}
Write-Information "="*60 -InformationAction Continue

exit $totalIssues
