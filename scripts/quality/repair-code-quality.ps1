# =====================================================
# AUTOMATED CODE QUALITY REPAIR
# =====================================================

$ErrorActionPreference = 'Continue'
$repairsApplied = 0

Write-Information "=== AUTOMATED CODE QUALITY REPAIR ===" -InformationAction Continue
Write-Information "Attempting to fix common code quality issues..." -InformationAction Continue
Write-Information "" -InformationAction Continue

# Auto-fix ESLint issues
Write-Information "[1/3] Auto-fixing ESLint issues..." -InformationAction Continue
try {
    npm run lint:fix --silent
    Write-Information "  ✅ ESLint auto-fixes applied" -InformationAction Continue
    $repairsApplied++
} catch {
    Write-Information "  ⚠ Some ESLint issues require manual fixing" -InformationAction Continue
}

# Auto-format code with Prettier
Write-Information "[2/3] Auto-formatting code with Prettier..." -InformationAction Continue
try {
    npm run format --silent
    Write-Information "  ✅ Code formatting applied" -InformationAction Continue
    $repairsApplied++
} catch {
    Write-Information "  ⚠ Code formatting failed" -InformationAction Continue
}

# PowerShell script cleanup (trailing whitespace, BOM encoding)
Write-Information "[3/3] PowerShell script cleanup..." -InformationAction Continue
$psScripts = Get-ChildItem -Path './scripts' -Filter '*.ps1' -Recurse
foreach ($script in $psScripts) {
    try {
        # Remove trailing whitespace and ensure BOM encoding
        $content = Get-Content $script.FullName -Raw
        $cleanContent = $content -replace '\s+$', '' -split "`n" -join "`n"
        $cleanContent | Out-File $script.FullName -Encoding UTF8BOM
    } catch {
        Write-Information "  ⚠ Failed to clean $($script.Name): $_" -InformationAction Continue
    }
}
Write-Information "  ✅ PowerShell scripts cleaned" -InformationAction Continue
$repairsApplied++

Write-Information "
=== REPAIR SUMMARY ===" -InformationAction Continue
Write-Information "Applied $repairsApplied automated repairs" -InformationAction Continue
Write-Information "Run validate-code-quality.ps1 to verify fixes" -InformationAction Continue
