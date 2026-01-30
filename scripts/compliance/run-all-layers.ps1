# Run All Compliance Layers
# Executes complete STRICT_ENGINEERING_CONTRACT_2026.txt compliance check
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [switch]$Fix = $false,
    [switch]$ContinueOnFail = $false,
    [switch]$Verbose = $false,
    [string]$OutputReport = "$ProjectRoot\compliance-report.html"
)

$ErrorActionPreference = 'Stop'

Write-Information "=== FULL COMPLIANCE CHECK: STRICT_ENGINEERING_CONTRACT_2026 ===" -InformationAction Continue
Write-Information "Project: $ProjectRoot" -InformationAction Continue
Write-Information "Started: $(Get-Date)" -InformationAction Continue

$allResults = @()
$totalIssues = 0
# Removed unused totalWarnings variable per PSScriptAnalyzer
$overallStart = Get-Date

# Layer execution order
$layers = @(
    @{ Name = "Layer A"; Script = "layer-a-static-gates.ps1"; Description = "Static Analysis" },
    @{ Name = "Layer B"; Script = "layer-b-runtime-gates.ps1"; Description = "Runtime Validation" },
    @{ Name = "Layer C"; Script = "layer-c-integration-gates.ps1"; Description = "Integration Testing" },
    @{ Name = "Layer D"; Script = "layer-d-ui-e2e-gates.ps1"; Description = "UI/E2E Testing" },
    @{ Name = "Layer E"; Script = "layer-e-release-gates.ps1"; Description = "Release Validation" }
)

foreach ($layer in $layers) {
    Write-Information "`n" + "="*80 -InformationAction Continue
    Write-Information "EXECUTING: $($layer.Name) - $($layer.Description)" -InformationAction Continue
    Write-Information "="*80 -InformationAction Continue
    
    $layerStart = Get-Date
    $scriptPath = Join-Path $PSScriptRoot $layer.Script
    
    try {
        if (Test-Path $scriptPath) {
            $params = @{
                ProjectRoot = $ProjectRoot
                Verbose     = $Verbose
            }
            
            # Add layer-specific parameters
            if ($layer.Name -eq "Layer A" -and $Fix) {
                $params.Fix = $true
            }
            
            # Execute layer script
            $layerExitCode = & $scriptPath @params
            $layerDuration = (Get-Date) - $layerStart
            
            $result = @{
                Layer       = $layer.Name
                Description = $layer.Description
                ExitCode    = $layerExitCode
                Duration    = $layerDuration
                Status      = if ($layerExitCode -eq 0) { "PASS" } else { "FAIL" }
                Issues      = $layerExitCode
            }
            
            $allResults += $result
            $totalIssues += $layerExitCode
            
            if ($layerExitCode -eq 0) {
                Write-Information "`n$($layer.Name): ✓ PASS (0 issues, $($layerDuration.TotalSeconds.ToString('F1'))s)" -InformationAction Continue
            }
            else {
                Write-Information "`n$($layer.Name): ✗ FAIL ($layerExitCode issues, $($layerDuration.TotalSeconds.ToString('F1'))s)" -InformationAction Continue
                
                if (-not $ContinueOnFail) {
                    Write-Information "`nStopping execution due to failures. Use -ContinueOnFail to run all layers." -InformationAction Continue
                    break
                }
            }
        }
        else {
            Write-Error "Script not found: $scriptPath"
            $allResults += @{
                Layer       = $layer.Name
                Description = $layer.Description
                ExitCode    = 999
                Duration    = [timespan]::Zero
                Status      = "MISSING"
                Issues      = 1
            }
            $totalIssues += 1
        }
    }
    catch {
        Write-Error "Layer execution failed: $_"
        $allResults += @{
            Layer       = $layer.Name
            Description = $layer.Description
            ExitCode    = 998
            Duration    = (Get-Date) - $layerStart
            Status      = "ERROR"
            Issues      = 1
        }
        $totalIssues += 1
        
        if (-not $ContinueOnFail) {
            break
        }
    }
}

$overallDuration = (Get-Date) - $overallStart

# Generate summary report
Write-Information "`n" + "="*80 -InformationAction Continue
Write-Information "COMPLIANCE SUMMARY" -InformationAction Continue
Write-Information "="*80 -InformationAction Continue

Write-Information "`nExecution Time: $($overallDuration.TotalMinutes.ToString('F1')) minutes" -InformationAction Continue
Write-Information "Total Issues: $totalIssues" -InformationAction Continue

Write-Information "`nLAYER RESULTS:" -InformationAction Continue
foreach ($result in $allResults) {
    Write-Information "  $($result.Layer): $($result.Status) ($($result.Issues) issues, $($result.Duration.TotalSeconds.ToString('F1'))s)" -InformationAction Continue
}

# Generate HTML report
if ($OutputReport) {
    Write-Information "Generating report: $OutputReport" -InformationAction Continue
    
    $htmlReport = @"
<!DOCTYPE html>
<html>
<head>
    <title>Compliance Report - $(Split-Path $ProjectRoot -Leaf)</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; background-color: #f5f5f5; }
        .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .layer { background-color: white; padding: 15px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .pass { border-left: 5px solid #27ae60; }
        .fail { border-left: 5px solid #e74c3c; }
        .missing { border-left: 5px solid #9b59b6; }
        .error { border-left: 5px solid #c0392b; }
        .status-badge { padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; }
        .status-pass { background-color: #27ae60; }
        .status-fail { background-color: #e74c3c; }
        .status-missing { background-color: #9b59b6; }
        .status-error { background-color: #c0392b; }
        .metric { display: inline-block; margin-right: 20px; padding: 10px; background-color: #ecf0f1; border-radius: 4px; }
        .footer { text-align: center; color: #7f8c8d; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Compliance Report: $(Split-Path $ProjectRoot -Leaf)</h1>
        <p>Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
        <p>Contract: STRICT_ENGINEERING_CONTRACT_2026.txt</p>
    </div>
    
    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metric">
            <strong>Total Issues:</strong> $totalIssues
        </div>
        <div class="metric">
            <strong>Execution Time:</strong> $($overallDuration.TotalMinutes.ToString('F1')) minutes
        </div>
        <div class="metric">
            <strong>Layers Executed:</strong> $($allResults.Count)
        </div>
        <div class="metric">
            <strong>Overall Status:</strong> 
            <span class="status-badge status-$(if ($totalIssues -eq 0) { 'pass' } else { 'fail' })">
                $(if ($totalIssues -eq 0) { 'COMPLIANT' } else { 'NON-COMPLIANT' })
            </span>
        </div>
    </div>
    
    <h2>Layer Results</h2>
"@

    foreach ($result in $allResults) {
        $statusClass = $result.Status.ToLower()
        $htmlReport += @"
    <div class="layer $statusClass">
        <h3>$($result.Layer) - $($result.Description)</h3>
        <p>
            <span class="status-badge status-$statusClass">$($result.Status)</span>
            <strong>Issues:</strong> $($result.Issues) | 
            <strong>Duration:</strong> $($result.Duration.TotalSeconds.ToString('F1'))s |
            <strong>Exit Code:</strong> $($result.ExitCode)
        </p>
    </div>
"@
    }

    $htmlReport += @"
    
    <div class="footer">
        <p>Report generated by STRICT_ENGINEERING_CONTRACT_2026 compliance framework</p>
        <p>For details on specific issues, review individual layer logs</p>
    </div>
</body>
</html>
"@

    $htmlReport | Out-File $OutputReport -Encoding UTF8
    Write-Information "Report saved: $OutputReport" -InformationAction Continue
}

# Final verdict
Write-Information "`n" + "="*80 -InformationAction Continue
if ($totalIssues -eq 0) {
    Write-Information "🎉 PROJECT IS COMPLIANT" -InformationAction Continue
    Write-Information "All layers passed successfully!" -InformationAction Continue
}
else {
    Write-Information "❌ PROJECT IS NON-COMPLIANT" -InformationAction Continue
    Write-Information "Fix $totalIssues issues across $($allResults.Count) layers" -InformationAction Continue
    
    Write-Information "`nNext steps:" -InformationAction Continue
    Write-Information "1. Review individual layer outputs for specific issues" -InformationAction Continue
    Write-Information "2. Run layers with -Fix flag where available" -InformationAction Continue
    Write-Information "3. Address issues manually where automated fixes aren't available" -InformationAction Continue
    Write-Information "4. Re-run compliance check until all issues resolved" -InformationAction Continue
}
Write-Information "="*80 -InformationAction Continue

exit $totalIssues


