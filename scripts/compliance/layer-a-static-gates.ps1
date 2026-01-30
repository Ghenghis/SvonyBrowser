# Layer A - Static Gates (Fast)
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 7 Layer A requirements
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [switch]$Fix = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== LAYER A: Static Gates Analysis ===" -InformationAction Continue
Write-Information "Project: $ProjectRoot" -InformationAction Continue

$issues = @()
$warnings = @()

# 1. FORMATTER CHECK
Write-Information "`n[1/4] Formatter Check..." -InformationAction Continue

$formatters = @{
    '.cs'  = { dotnet format --verify-no-changes --verbosity quiet $ProjectRoot }
    '.js'  = { npx prettier --check "**/*.js" --cwd $ProjectRoot }
    '.ts'  = { npx prettier --check "**/*.ts" --cwd $ProjectRoot }
    '.ps1' = { Invoke-ScriptAnalyzer -Path $ProjectRoot -Recurse -Settings PSGallery }
    '.py'  = { python -m black --check $ProjectRoot }
    '.rs'  = { cargo fmt --check --manifest-path "$ProjectRoot\Cargo.toml" }
}

foreach ($ext in $formatters.Keys) {
    $files = Get-ChildItem -Path $ProjectRoot -Recurse -Filter "*$ext" -ErrorAction SilentlyContinue
    if ($files) {
        try {
            & $formatters[$ext]
            Write-Information "  ✓ $ext formatting OK" -InformationAction Continue
        }
        catch {
            $issues += "Formatting violations in $ext files: $_"
            Write-Information "  ✗ $ext formatting FAIL" -InformationAction Continue
            if ($Fix) {
                Write-Information "    → Attempting auto-fix..." -InformationAction Continue
                # Auto-fix logic for each formatter
            }
        }
    }
}

# 2. LINTER/ANALYZER CHECK
Write-Information "`n[2/4] Linter/Analyzer Check..." -InformationAction Continue

$linters = @{
    '.cs'  = { dotnet build --verbosity quiet --no-restore $ProjectRoot; if ($LASTEXITCODE -ne 0) { throw "Build warnings/errors detected" } }
    '.js'  = { npx eslint "**/*.js" --cwd $ProjectRoot }
    '.ts'  = { npx eslint "**/*.ts" --cwd $ProjectRoot }
    '.ps1' = { Invoke-ScriptAnalyzer -Path $ProjectRoot -Recurse -Severity Warning, Error }
    '.py'  = { python -m ruff check $ProjectRoot }
    '.rs'  = { cargo clippy --manifest-path "$ProjectRoot\Cargo.toml" -- -D warnings }
}

foreach ($ext in $linters.Keys) {
    $files = Get-ChildItem -Path $ProjectRoot -Recurse -Filter "*$ext" -ErrorAction SilentlyContinue
    if ($files) {
        try {
            & $linters[$ext] | Out-Null
            Write-Information "  ✓ $ext linting OK" -InformationAction Continue
        }
        catch {
            $issues += "Linting violations in $ext files: $_"
            Write-Information "  ✗ $ext linting FAIL" -InformationAction Continue
        }
    }
}

# 3. TYPECHECK/COMPILE
Write-Information "`n[3/4] Type Check/Compile..." -InformationAction Continue

if (Test-Path "$ProjectRoot\*.sln" -PathType Leaf) {
    try {
        dotnet build --no-restore --verbosity quiet $ProjectRoot
        Write-Information "  ✓ C# compilation OK" -InformationAction Continue
    }
    catch {
        $issues += "C# compilation failed: $_"
        Write-Information "  ✗ C# compilation FAIL" -InformationAction Continue
    }
}

if (Test-Path "$ProjectRoot\tsconfig.json" -PathType Leaf) {
    try {
        npx tsc --noEmit --project $ProjectRoot
        Write-Information "  ✓ TypeScript compilation OK" -InformationAction Continue
    }
    catch {
        $issues += "TypeScript compilation failed: $_"
        Write-Information "  ✗ TypeScript compilation FAIL" -InformationAction Continue
    }
}

if (Test-Path "$ProjectRoot\Cargo.toml" -PathType Leaf) {
    try {
        cargo check --manifest-path "$ProjectRoot\Cargo.toml"
        Write-Information "  ✓ Rust compilation OK" -InformationAction Continue
    }
    catch {
        $issues += "Rust compilation failed: $_"
        Write-Information "  ✗ Rust compilation FAIL" -InformationAction Continue
    }
}

# 4. FORBIDDEN PATTERN SCAN
Write-Information "`n[4/4] Forbidden Pattern Scan..." -InformationAction Continue

$forbiddenPatterns = @{
    'TODO:'                           = 'TODO comments in runtime code'
    'FIXME:'                          = 'FIXME comments in runtime code'
    'STUB'                            = 'Stub implementations'
    'PLACEHOLDER'                     = 'Placeholder code'
    'NOT_IMPLEMENTED'                 = 'Not implemented markers'
    'mock data'                       = 'Mock data in runtime paths'
    'catch\s*\(\s*\)\s*\{[\s\r\n]*\}' = 'Empty catch blocks'
    'return null;?\s*//.*placeholder' = 'Null return placeholders'
}

$runtimePaths = @(
    "$ProjectRoot\src\**\*.cs",
    "$ProjectRoot\src\**\*.js", 
    "$ProjectRoot\src\**\*.ts",
    "$ProjectRoot\src\**\*.py",
    "$ProjectRoot\src\**\*.rs"
)

foreach ($pattern in $forbiddenPatterns.Keys) {
    $description = $forbiddenPatterns[$pattern]
    $found = $false
    
    foreach ($path in $runtimePaths) {
        $files = Get-ChildItem -Path $path -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
            if ($content -match $pattern) {
                $issues += "Forbidden pattern '$description' found in $($file.FullName)"
                $found = $true
            }
        }
    }
    
    if ($found) {
        Write-Information "  ✗ $description found: $($matches.Count) instances" -InformationAction Continue
    }
    else {
        Write-Information "  ✓ $description OK" -InformationAction Continue
    }
}

# 5. WARNING ALLOWLIST VALIDATION
Write-Information "`n[5/5] Warning Allowlist Validation..." -InformationAction Continue

$allowlistPath = "$ProjectRoot\.warning-allowlist.yml"
if (Test-Path $allowlistPath) {
    try {
        $allowlist = Get-Content $allowlistPath | ConvertFrom-Yaml
        $today = Get-Date
        $expiredRules = @()
        
        foreach ($rule in $allowlist.rules) {
            $expiry = [datetime]$rule.expires
            if ($expiry -lt $today) {
                $expiredRules += "Rule $($rule.rule) in $($rule.path) expired on $($rule.expires)"
            }
        }
        
        if ($expiredRules.Count -gt 0) {
            $issues += $expiredRules
            Write-Information "  ✗ Expired allowlist rules found" -InformationAction Continue
        }
        elseif ($allowlist.rules.Count -gt 10) {
            $issues += "Warning allowlist has $($allowlist.rules.Count) entries (limit: 10)"
            Write-Information "  ✗ Too many allowlist entries" -InformationAction Continue
        }
        else {
            Write-Information "  ✓ Warning allowlist OK" -InformationAction Continue
        }
    }
    catch {
        $warnings += "Could not parse warning allowlist: $_"
        Write-Information "  ⚠ Warning allowlist parse error" -InformationAction Continue
    }
}
else {
    Write-Information "  ✓ No warning allowlist (default: zero warnings)" -InformationAction Continue
}

# SUMMARY
Write-Information "`n=== LAYER A SUMMARY ===" -InformationAction Continue
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

if ($Verbose) {
    Write-Information "`nNext: Run Layer B (Runtime Gates)" -InformationAction Continue
    Write-Information "Command: .\scripts\compliance\layer-b-runtime-gates.ps1" -InformationAction Continue
}

exit $issues.Count


