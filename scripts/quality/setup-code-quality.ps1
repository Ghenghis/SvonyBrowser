# =====================================================
# CODE QUALITY FRAMEWORK SETUP
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
# =====================================================

param(
    [switch]$InstallTools,
    [switch]$ConfigureHooks,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'

Write-Information "=== SVONY BROWSER - CODE QUALITY FRAMEWORK SETUP ===" -InformationAction Continue
Write-Information "Version: 2.2.13 Release Preparation" -InformationAction Continue
Write-Information "" -InformationAction Continue

$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $projectRoot

# INSTALL QUALITY TOOLS
if ($InstallTools) {
    Write-Information "[1/4] Installing Code Quality Tools..." -InformationAction Continue
    
    # Install global npm tools
    Write-Information "  → Installing ESLint and Prettier globally..." -InformationAction Continue
    try {
        npm install -g eslint@latest prettier@latest eslint-config-prettier@latest
        Write-Information "  ✓ Global tools installed" -InformationAction Continue
    }
    catch {
        Write-Information "  ⚠ Global install failed, using local versions" -InformationAction Continue
    }
    
    # Install PowerShell PSScriptAnalyzer
    Write-Information "  → Installing PSScriptAnalyzer..." -InformationAction Continue
    try {
        if (-not (Get-Module -ListAvailable -Name PSScriptAnalyzer)) {
            Install-Module -Name PSScriptAnalyzer -Force -Scope CurrentUser
            Write-Information "  ✓ PSScriptAnalyzer installed" -InformationAction Continue
        }
        else {
            Write-Information "  ✓ PSScriptAnalyzer already installed" -InformationAction Continue
        }
    }
    catch {
        Write-Information "  ⚠ PSScriptAnalyzer install failed: $_" -InformationAction Continue
    }
}

# CONFIGURE GIT HOOKS
if ($ConfigureHooks) {
    Write-Information "[2/4] Configuring Git Hooks..." -InformationAction Continue
    
    # Enable Husky if not already enabled
    Write-Information "  → Enabling Husky Git hooks..." -InformationAction Continue
    try {
        npx husky install
        Write-Information "  ✓ Husky enabled" -InformationAction Continue
    }
    catch {
        Write-Information "  ⚠ Husky setup failed: $_" -InformationAction Continue
    }
    
    # Create pre-commit hook for PowerShell validation
    $preCommitHook = @"
#!/usr/bin/env sh
. `"`$(dirname -- `"`$0`")/_/husky.sh`"

# PowerShell Script Validation
echo "🔍 Running PowerShell Script Analysis..."
powershell -Command "& { 
    `$scripts = Get-ChildItem -Path './scripts' -Filter '*.ps1' -Recurse
    `$issues = 0
    foreach (`$script in `$scripts) {
        `$result = Invoke-ScriptAnalyzer -Path `$script.FullName -Severity Warning,Error
        if (`$result) {
            Write-Host `"❌ Issues found in `$(`$script.Name):`" -ForegroundColor Red
            `$result | ForEach-Object { Write-Host `"  - `$(`$_.RuleName): `$(`$_.Message)`" -ForegroundColor Yellow }
            `$issues++
        }
    }
    if (`$issues -gt 0) {
        Write-Host `"🚫 PowerShell validation failed. Please fix issues before committing.`" -ForegroundColor Red
        exit 1
    } else {
        Write-Host `"✅ All PowerShell scripts are compliant`" -ForegroundColor Green
    }
}"

# JavaScript/TypeScript Linting
echo "🔍 Running ESLint..."
npm run lint

# Prettier Formatting Check
echo "🔍 Checking code formatting..."
npm run format:check

echo "✅ Pre-commit validation complete!"
"@
    
    if (-not (Test-Path ".husky")) {
        New-Item -ItemType Directory -Path ".husky" | Out-Null
    }
    
    $preCommitHook | Out-File ".husky/pre-commit" -Encoding UTF8
    Write-Information "  ✓ Pre-commit hook created" -InformationAction Continue
}

# CREATE QUALITY VALIDATION SCRIPT
Write-Information "[3/4] Creating Quality Validation Scripts..." -InformationAction Continue

$validationScript = @"
# =====================================================
# COMPREHENSIVE CODE QUALITY VALIDATION
# =====================================================

`$ErrorActionPreference = 'Stop'
`$totalIssues = 0

Write-Information `"=== CODE QUALITY VALIDATION REPORT ===`" -InformationAction Continue
Write-Information `"Project: SvonyBrowser v2.2.13`" -InformationAction Continue
Write-Information `"Timestamp: `$(Get-Date)`" -InformationAction Continue
Write-Information `"`" -InformationAction Continue

# PowerShell Script Analysis
Write-Information `"[1/5] PowerShell Script Analysis...`" -InformationAction Continue
`$psScripts = Get-ChildItem -Path './scripts' -Filter '*.ps1' -Recurse
`$psIssues = 0

foreach (`$script in `$psScripts) {
    `$result = Invoke-ScriptAnalyzer -Path `$script.FullName -Severity Warning,Error
    if (`$result) {
        `$psIssues += `$result.Count
        Write-Information `"  ❌ `$(`$script.Name): `$(`$result.Count) issues`" -InformationAction Continue
    } else {
        Write-Information `"  ✅ `$(`$script.Name): Clean`" -InformationAction Continue
    }
}

Write-Information `"PowerShell Analysis: `$(`$psScripts.Count) scripts, `$psIssues total issues`" -InformationAction Continue
`$totalIssues += `$psIssues

# JavaScript/TypeScript Linting
Write-Information `"`n[2/5] JavaScript/TypeScript Linting...`" -InformationAction Continue
try {
    npm run lint --silent
    Write-Information `"  ✅ ESLint validation passed`" -InformationAction Continue
} catch {
    Write-Information `"  ❌ ESLint validation failed`" -InformationAction Continue
    `$totalIssues++
}

# Code Formatting Check
Write-Information `"`n[3/5] Code Formatting Check...`" -InformationAction Continue
try {
    npm run format:check --silent
    Write-Information `"  ✅ Code formatting is consistent`" -InformationAction Continue
} catch {
    Write-Information `"  ❌ Code formatting issues found`" -InformationAction Continue
    `$totalIssues++
}

# TypeScript Type Checking
Write-Information `"`n[4/5] TypeScript Type Checking...`" -InformationAction Continue
try {
    npm run type-check --silent
    Write-Information `"  ✅ TypeScript validation passed`" -InformationAction Continue
} catch {
    Write-Information `"  ❌ TypeScript validation failed`" -InformationAction Continue
    `$totalIssues++
}

# Security Audit
Write-Information `"`n[5/5] Security Audit...`" -InformationAction Continue
try {
    npm audit --audit-level=moderate --silent
    Write-Information `"  ✅ No security vulnerabilities found`" -InformationAction Continue
} catch {
    Write-Information `"  ⚠ Security vulnerabilities detected`" -InformationAction Continue
    `$totalIssues++
}

# Summary
Write-Information `"`n=== VALIDATION SUMMARY ===`" -InformationAction Continue
if (`$totalIssues -eq 0) {
    Write-Information `"🎉 ALL QUALITY CHECKS PASSED!`" -InformationAction Continue
    Write-Information `"Code is ready for release 2.2.13`" -InformationAction Continue
    exit 0
} else {
    Write-Information `"🚫 QUALITY ISSUES FOUND: `$totalIssues`" -InformationAction Continue
    Write-Information `"Please fix issues before proceeding with release`" -InformationAction Continue
    exit 1
}
"@

$validationScript | Out-File "scripts/quality/validate-code-quality.ps1" -Encoding UTF8BOM
Write-Information "  ✓ Quality validation script created" -InformationAction Continue

# CREATE AUTOMATED REPAIR SCRIPT
Write-Information "[4/4] Creating Automated Repair Script..." -InformationAction Continue

$repairScript = @"
# =====================================================
# AUTOMATED CODE QUALITY REPAIR
# =====================================================

`$ErrorActionPreference = 'Continue'
`$repairsApplied = 0

Write-Information `"=== AUTOMATED CODE QUALITY REPAIR ===`" -InformationAction Continue
Write-Information `"Attempting to fix common code quality issues...`" -InformationAction Continue
Write-Information `"`" -InformationAction Continue

# Auto-fix ESLint issues
Write-Information `"[1/3] Auto-fixing ESLint issues...`" -InformationAction Continue
try {
    npm run lint:fix --silent
    Write-Information `"  ✅ ESLint auto-fixes applied`" -InformationAction Continue
    `$repairsApplied++
} catch {
    Write-Information `"  ⚠ Some ESLint issues require manual fixing`" -InformationAction Continue
}

# Auto-format code with Prettier
Write-Information `"[2/3] Auto-formatting code with Prettier...`" -InformationAction Continue
try {
    npm run format --silent
    Write-Information `"  ✅ Code formatting applied`" -InformationAction Continue
    `$repairsApplied++
} catch {
    Write-Information `"  ⚠ Code formatting failed`" -InformationAction Continue
}

# PowerShell script cleanup (trailing whitespace, BOM encoding)
Write-Information `"[3/3] PowerShell script cleanup...`" -InformationAction Continue
`$psScripts = Get-ChildItem -Path './scripts' -Filter '*.ps1' -Recurse
foreach (`$script in `$psScripts) {
    try {
        # Remove trailing whitespace and ensure BOM encoding
        `$content = Get-Content `$script.FullName -Raw
        `$cleanContent = `$content -replace '\s+$', '' -split `"``n`" -join `"``n`"
        `$cleanContent | Out-File `$script.FullName -Encoding UTF8BOM
    } catch {
        Write-Information `"  ⚠ Failed to clean `$(`$script.Name): `$_`" -InformationAction Continue
    }
}
Write-Information `"  ✅ PowerShell scripts cleaned`" -InformationAction Continue
`$repairsApplied++

Write-Information `"`n=== REPAIR SUMMARY ===`" -InformationAction Continue
Write-Information `"Applied `$repairsApplied automated repairs`" -InformationAction Continue
Write-Information `"Run validate-code-quality.ps1 to verify fixes`" -InformationAction Continue
"@

$repairScript | Out-File "scripts/quality/repair-code-quality.ps1" -Encoding UTF8BOM
Write-Information "  ✓ Automated repair script created" -InformationAction Continue

Write-Information "" -InformationAction Continue
Write-Information "=== CODE QUALITY FRAMEWORK SETUP COMPLETE ===" -InformationAction Continue
Write-Information "✅ Quality validation scripts created" -InformationAction Continue
Write-Information "✅ Automated repair tools configured" -InformationAction Continue
if ($ConfigureHooks) {
    Write-Information "✅ Git hooks configured" -InformationAction Continue
}
if ($InstallTools) {
    Write-Information "✅ Development tools installed" -InformationAction Continue
}

Write-Information "" -InformationAction Continue
Write-Information "NEXT STEPS:" -InformationAction Continue
Write-Information "1. Run: .\scripts\quality\validate-code-quality.ps1" -InformationAction Continue
Write-Information "2. Fix any issues found" -InformationAction Continue
Write-Information "3. Run: .\scripts\quality\repair-code-quality.ps1 (for auto-fixable issues)" -InformationAction Continue
Write-Information "4. Commit changes to enable quality gates" -InformationAction Continue
