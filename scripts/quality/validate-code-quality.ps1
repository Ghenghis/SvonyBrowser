# =====================================================
# COMPREHENSIVE CODE QUALITY VALIDATION
# =====================================================

$ErrorActionPreference = 'Stop'
$totalIssues = 0

Write-Information "=== CODE QUALITY VALIDATION REPORT ===" -InformationAction Continue
Write-Information "Project: SvonyBrowser v2.2.13" -InformationAction Continue
Write-Information "Timestamp: $(Get-Date)" -InformationAction Continue
Write-Information "" -InformationAction Continue

# PowerShell Script Analysis
Write-Information "[1/5] PowerShell Script Analysis..." -InformationAction Continue
$psScripts = Get-ChildItem -Path './scripts' -Filter '*.ps1' -Recurse
$psIssues = 0

foreach ($script in $psScripts) {
    $result = Invoke-ScriptAnalyzer -Path $script.FullName -Severity Warning,Error
    if ($result) {
        $psIssues += $result.Count
        Write-Information "  ❌ $($script.Name): $($result.Count) issues" -InformationAction Continue
    } else {
        Write-Information "  ✅ $($script.Name): Clean" -InformationAction Continue
    }
}

Write-Information "PowerShell Analysis: $($psScripts.Count) scripts, $psIssues total issues" -InformationAction Continue
$totalIssues += $psIssues

# JavaScript/TypeScript Linting
Write-Information "
[2/5] JavaScript/TypeScript Linting..." -InformationAction Continue
try {
    npm run lint --silent
    Write-Information "  ✅ ESLint validation passed" -InformationAction Continue
} catch {
    Write-Information "  ❌ ESLint validation failed" -InformationAction Continue
    $totalIssues++
}

# Code Formatting Check
Write-Information "
[3/5] Code Formatting Check..." -InformationAction Continue
try {
    npm run format:check --silent
    Write-Information "  ✅ Code formatting is consistent" -InformationAction Continue
} catch {
    Write-Information "  ❌ Code formatting issues found" -InformationAction Continue
    $totalIssues++
}

# TypeScript Type Checking
Write-Information "
[4/5] TypeScript Type Checking..." -InformationAction Continue
try {
    npm run type-check --silent
    Write-Information "  ✅ TypeScript validation passed" -InformationAction Continue
} catch {
    Write-Information "  ❌ TypeScript validation failed" -InformationAction Continue
    $totalIssues++
}

# Security Audit
Write-Information "
[5/5] Security Audit..." -InformationAction Continue
try {
    npm audit --audit-level=moderate --silent
    Write-Information "  ✅ No security vulnerabilities found" -InformationAction Continue
} catch {
    Write-Information "  ⚠ Security vulnerabilities detected" -InformationAction Continue
    $totalIssues++
}

# Summary
Write-Information "
=== VALIDATION SUMMARY ===" -InformationAction Continue
if ($totalIssues -eq 0) {
    Write-Information "🎉 ALL QUALITY CHECKS PASSED!" -InformationAction Continue
    Write-Information "Code is ready for release 2.2.13" -InformationAction Continue
    exit 0
} else {
    Write-Information "🚫 QUALITY ISSUES FOUND: $totalIssues" -InformationAction Continue
    Write-Information "Please fix issues before proceeding with release" -InformationAction Continue
    exit 1
}
