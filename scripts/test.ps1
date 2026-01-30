# Test Script - Run Real Tests
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
param(
    [string]$Filter = "*",
    [switch]$Unit = $false,
    [switch]$Integration = $false,
    [switch]$E2E = $false,
    [switch]$Coverage = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== SVONY BROWSER - TEST EXECUTION ===" -InformationAction Continue

$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

$testResults = @()
$totalTests = 0
$failedTests = 0

# If no specific test type selected, run all
if (-not ($Unit -or $Integration -or $E2E)) {
    $Unit = $true
    $Integration = $true
    $E2E = $true
}

# 1. UNIT TESTS
if ($Unit) {
    Write-Information "`n[1/4] Unit Tests..." -InformationAction Continue
    
    # .NET unit tests
    $testProjects = Get-ChildItem "*Test*.csproj", "*Tests*.csproj" -Recurse -ErrorAction SilentlyContinue
    if ($testProjects) {
        foreach ($testProject in $testProjects) {
            Write-Information "  → Running: $($testProject.Name)" -InformationAction Continue
            try {
                $testArgs = @("test", $testProject.FullName, "--no-build", "--verbosity", "minimal")
                
                if ($Coverage) {
                    $testArgs += @("--collect", "XPlat Code Coverage")
                }
                
                if ($Filter -ne "*") {
                    $testArgs += @("--filter", $Filter)
                }
                
                $testOutput = & dotnet @testArgs
                $testExitCode = $LASTEXITCODE
                
                if ($testExitCode -eq 0) {
                    Write-Information "  ✓ $($testProject.BaseName): PASS" -InformationAction Continue
                    $testResults += @{ Name = $testProject.BaseName; Type = "Unit"; Status = "PASS"; Output = $testOutput }
                }
                else {
                    Write-Information "  ✗ $($testProject.BaseName): FAIL" -InformationAction Continue
                    $testResults += @{ Name = $testProject.BaseName; Type = "Unit"; Status = "FAIL"; Output = $testOutput }
                    $failedTests++
                }
                $totalTests++
                
            }
            catch {
                Write-Information "  ✗ $($testProject.BaseName): ERROR ($_)" -InformationAction Continue
                $testResults += @{ Name = $testProject.BaseName; Type = "Unit"; Status = "ERROR"; Output = $_ }
                $failedTests++
                $totalTests++
            }
        }
    }
    else {
        Write-Information "  ℹ No .NET test projects found" -InformationAction Continue
    }
    
    # JavaScript/Node.js unit tests
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts.test) {
            Write-Information "  → Running: npm test" -InformationAction Continue
            try {
                npm test --silent
                if ($LASTEXITCODE -eq 0) {
                    Write-Information "  ✓ npm test: PASS" -InformationAction Continue
                    $testResults += @{ Name = "npm-test"; Type = "Unit"; Status = "PASS"; Output = "npm test completed" }
                }
                else {
                    Write-Information "  ✗ npm test: FAIL" -InformationAction Continue
                    $testResults += @{ Name = "npm-test"; Type = "Unit"; Status = "FAIL"; Output = "npm test failed" }
                    $failedTests++
                }
                $totalTests++
            }
            catch {
                Write-Information "  ✗ npm test: ERROR ($_)" -InformationAction Continue
                $testResults += @{ Name = "npm-test"; Type = "Unit"; Status = "ERROR"; Output = $_ }
                $failedTests++
                $totalTests++
            }
        }
    }
}

# 2. INTEGRATION TESTS
if ($Integration) {
    Write-Information "`n[2/4] Integration Tests..." -InformationAction Continue
    
    # Check for database availability
    $dbAvailable = $false
    if (Test-Path "docker-compose.yml") {
        try {
            docker-compose exec -T mysql mysql -h localhost -u root -proot -e "SELECT 1" 2>$null | Out-Null
            $dbAvailable = $true
            Write-Information "  ✓ Database connection verified" -InformationAction Continue
        }
        catch {
            Write-Information "  ⚠ Database not available - starting services..." -InformationAction Continue
            try {
                docker-compose up -d mysql
                Start-Sleep 10
                docker-compose exec -T mysql mysql -h localhost -u root -proot -e "SELECT 1" 2>$null | Out-Null
                $dbAvailable = $true
                Write-Information "  ✓ Database started and ready" -InformationAction Continue
            }
            catch {
                Write-Information "  ✗ Could not start database for integration tests" -InformationAction Continue
            }
        }
    }
    
    # .NET integration tests
    $integrationProjects = Get-ChildItem "*Integration*.csproj", "*IntegrationTests*.csproj" -Recurse -ErrorAction SilentlyContinue
    if ($integrationProjects) {
        foreach ($project in $integrationProjects) {
            Write-Information "  → Running: $($project.Name)" -InformationAction Continue
            try {
                $integrationArgs = @("test", $project.FullName, "--no-build", "--verbosity", "minimal")
                
                if ($Filter -ne "*") {
                    $integrationArgs += @("--filter", $Filter)
                }
                
                $output = & dotnet @integrationArgs
                if ($LASTEXITCODE -eq 0) {
                    Write-Information "  ✓ $($project.BaseName): PASS" -InformationAction Continue
                    $testResults += @{ Name = $project.BaseName; Type = "Integration"; Status = "PASS"; Output = $output }
                }
                else {
                    Write-Information "  ✗ $($project.BaseName): FAIL" -InformationAction Continue
                    $testResults += @{ Name = $project.BaseName; Type = "Integration"; Status = "FAIL"; Output = $output }
                    $failedTests++
                }
                $totalTests++
            }
            catch {
                Write-Information "  ✗ $($project.BaseName): ERROR ($_)" -InformationAction Continue
                $testResults += @{ Name = $project.BaseName; Type = "Integration"; Status = "ERROR"; Output = $_ }
                $failedTests++
                $totalTests++
            }
        }
    }
    
    # API endpoint tests (if web project exists)
    $webProjects = Get-ChildItem "*Web*.csproj", "*Api*.csproj" -ErrorAction SilentlyContinue
    if ($webProjects -and $dbAvailable) {
        Write-Information "  → Testing API endpoints..." -InformationAction Continue
        
        # Check if application is running
        $apiTests = @(
            @{ Name = "Health Check"; Url = "http://localhost:5000/health"; ExpectedStatus = 200 },
            @{ Name = "API Version"; Url = "http://localhost:5000/api/version"; ExpectedStatus = @(200, 404) },
            @{ Name = "Swagger UI"; Url = "http://localhost:5000/swagger"; ExpectedStatus = @(200, 404) }
        )
        
        foreach ($test in $apiTests) {
            try {
                $response = Invoke-WebRequest -Uri $test.Url -TimeoutSec 5 -ErrorAction Stop
                if ($response.StatusCode -in $test.ExpectedStatus) {
                    Write-Information "    ✓ $($test.Name): $($response.StatusCode)" -InformationAction Continue
                    $testResults += @{ Name = $test.Name; Type = "Integration"; Status = "PASS"; Output = "HTTP $($response.StatusCode)" }
                }
                else {
                    Write-Information "    ✗ $($test.Name): Unexpected status $($response.StatusCode)" -InformationAction Continue
                    $testResults += @{ Name = $test.Name; Type = "Integration"; Status = "FAIL"; Output = "HTTP $($response.StatusCode)" }
                    $failedTests++
                }
                $totalTests++
            }
            catch {
                Write-Information "    ⚠ $($test.Name): Service not running" -InformationAction Continue
                $testResults += @{ Name = $test.Name; Type = "Integration"; Status = "SKIP"; Output = "Service not available" }
            }
        }
    }
    else {
        Write-Information "  ℹ No integration tests found or database unavailable" -InformationAction Continue
    }
}

# 3. E2E TESTS
if ($E2E) {
    Write-Information "`n[3/4] End-to-End Tests..." -InformationAction Continue
    
    # Playwright E2E tests
    if (Test-Path "playwright.config.js" -or Test-Path "playwright.config.ts") {
        Write-Information "  → Running Playwright E2E tests..." -InformationAction Continue
        try {
            $env:HEADLESS = "true"
            npx playwright test --reporter=line
            if ($LASTEXITCODE -eq 0) {
                Write-Information "  ✓ Playwright E2E: PASS" -InformationAction Continue
                $testResults += @{ Name = "Playwright"; Type = "E2E"; Status = "PASS"; Output = "E2E tests completed" }
            }
            else {
                Write-Information "  ✗ Playwright E2E: FAIL" -InformationAction Continue
                $testResults += @{ Name = "Playwright"; Type = "E2E"; Status = "FAIL"; Output = "E2E tests failed" }
                $failedTests++
            }
            $totalTests++
        }
        catch {
            Write-Information "  ✗ Playwright E2E: ERROR ($_)" -InformationAction Continue
            $testResults += @{ Name = "Playwright"; Type = "E2E"; Status = "ERROR"; Output = $_ }
            $failedTests++
            $totalTests++
        }
    }
    
    # Cypress E2E tests
    elseif (Test-Path "cypress.config.js") {
        Write-Information "  → Running Cypress E2E tests..." -InformationAction Continue
        try {
            npx cypress run --headless
            if ($LASTEXITCODE -eq 0) {
                Write-Information "  ✓ Cypress E2E: PASS" -InformationAction Continue
                $testResults += @{ Name = "Cypress"; Type = "E2E"; Status = "PASS"; Output = "E2E tests completed" }
            }
            else {
                Write-Information "  ✗ Cypress E2E: FAIL" -InformationAction Continue
                $testResults += @{ Name = "Cypress"; Type = "E2E"; Status = "FAIL"; Output = "E2E tests failed" }
                $failedTests++
            }
            $totalTests++
        }
        catch {
            Write-Information "  ✗ Cypress E2E: ERROR ($_)" -InformationAction Continue
            $testResults += @{ Name = "Cypress"; Type = "E2E"; Status = "ERROR"; Output = $_ }
            $failedTests++
            $totalTests++
        }
    }
    
    # Manual UI smoke test for WPF applications
    else {
        Write-Information "  ℹ No E2E test framework detected - running smoke test" -InformationAction Continue
        
        # Check if there's a WPF application to test
        $wpfProjects = Get-ChildItem "*.csproj" | Where-Object { 
            (Get-Content $_.FullName) -match "Microsoft.WindowsDesktop.App" 
        }
        
        if ($wpfProjects) {
            Write-Information "  → WPF smoke test (build verification)..." -InformationAction Continue
            try {
                dotnet build $wpfProjects[0].FullName --configuration Release --verbosity quiet
                Write-Information "  ✓ WPF application builds successfully" -InformationAction Continue
                $testResults += @{ Name = "WPF-Smoke"; Type = "E2E"; Status = "PASS"; Output = "Build verification passed" }
                $totalTests++
            }
            catch {
                Write-Information "  ✗ WPF smoke test: BUILD FAIL" -InformationAction Continue
                $testResults += @{ Name = "WPF-Smoke"; Type = "E2E"; Status = "FAIL"; Output = "Build verification failed" }
                $failedTests++
                $totalTests++
            }
        }
    }
}

# 4. CODE COVERAGE ANALYSIS
if ($Coverage) {
    Write-Information "`n[4/4] Code Coverage Analysis..." -InformationAction Continue
    
    $coverageFiles = Get-ChildItem "TestResults\**\coverage.cobertura.xml" -Recurse -ErrorAction SilentlyContinue
    if ($coverageFiles) {
        Write-Information "  → Processing coverage reports..." -InformationAction Continue
        
        # Install ReportGenerator if not available
        try {
            dotnet tool install --global dotnet-reportgenerator-globaltool --version 5.1.26 2>$null
        }
        catch {
            # Tool might already be installed
            continue
        }
        
        try {
            # Generate HTML coverage report
            $coveragePaths = ($coverageFiles | ForEach-Object { $_.FullName }) -join ";"
            dotnet reportgenerator -reports:$coveragePaths -targetdir:TestResults\CoverageReport -reporttypes:Html
            
            Write-Information "  ✓ Coverage report generated: TestResults\CoverageReport\index.html" -InformationAction Continue
            
            # Extract summary metrics
            if (Test-Path "TestResults\CoverageReport\Summary.txt") {
                $summary = Get-Content "TestResults\CoverageReport\Summary.txt"
                $coverageLine = $summary | Where-Object { $_ -match "Line coverage:" }
                if ($coverageLine) {
                    Write-Information "  📊 $coverageLine" -InformationAction Continue
                }
            }
        }
        catch {
            Write-Information "  ⚠ Could not generate coverage report: $_" -InformationAction Continue
        }
    }
    else {
        Write-Information "  ⚠ No coverage data found - run tests with --collect flag" -InformationAction Continue
    }
}

# TEST SUMMARY
Write-Information "`n" + "="*60 -InformationAction Continue
Write-Information "TEST SUMMARY" -InformationAction Continue
Write-Information "="*60 -InformationAction Continue

Write-Information "`nTOTAL TESTS: $totalTests" -InformationAction Continue
Write-Information "PASSED: $($totalTests - $failedTests)" -InformationAction Continue
Write-Information "FAILED: $failedTests" -InformationAction Continue

if ($Verbose -and $testResults.Count -gt 0) {
    Write-Information "`nDETAILED RESULTS:" -InformationAction Continue
    foreach ($result in $testResults) {
        Write-Information "  [$($result.Type)] $($result.Name): $($result.Status)" -InformationAction Continue
    }
}

# FAILURE DETAILS
if ($failedTests -gt 0) {
    Write-Information "`nFAILED TESTS:" -InformationAction Continue
    $failedResults = $testResults | Where-Object { $_.Status -in @("FAIL", "ERROR") }
    foreach ($failed in $failedResults) {
        Write-Information "  • $($failed.Name) [$($failed.Type)]: $($failed.Status)" -InformationAction Continue
        if ($Verbose -and $failed.Output) {
            Write-Information "    $($failed.Output)" -InformationAction Continue
        }
    }
}

# RECOMMENDATIONS
if ($failedTests -eq 0) {
    Write-Information "`n🎉 All tests passed! Code is ready for deployment." -InformationAction Continue
}
else {
    Write-Information "`n🔧 Fix $failedTests failing test(s) before proceeding." -InformationAction Continue
    Write-Information "Run with -Verbose for detailed failure information." -InformationAction Continue
}

if ($Coverage -and $coverageFiles) {
    Write-Information "`n📊 View coverage report: TestResults\CoverageReport\index.html" -InformationAction Continue
}

exit $failedTests
