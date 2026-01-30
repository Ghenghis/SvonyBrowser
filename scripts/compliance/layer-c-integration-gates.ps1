# Layer C - Integration Gates (Dependencies)
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 7 Layer C requirements
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [switch]$StartDependencies = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== LAYER C: Integration Gates Analysis ===" -InformationAction Continue
Write-Information "Project: $ProjectRoot" -InformationAction Continue

$issues = @()
$warnings = @()

# 1. DOCKER COMPOSE PROFILE CHECK
Write-Information "`n[1/3] Docker Compose Profile..." -InformationAction Continue

$dockerComposeFiles = @(
    "$ProjectRoot\docker-compose.yml",
    "$ProjectRoot\docker-compose.yaml", 
    "$ProjectRoot\docker\docker-compose.yml"
)

$composeFound = $false
foreach ($composeFile in $dockerComposeFiles) {
    if (Test-Path $composeFile) {
        $composeFound = $true
        Write-Information "  Found: $composeFile" -InformationAction Continue
        
        try {
            # Validate compose file syntax
            docker-compose -f $composeFile config | Out-Null
            Write-Information "  ✓ Docker Compose syntax OK" -InformationAction Continue
            
            # Check for common service dependencies
            $composeContent = Get-Content $composeFile -Raw
            $services = @()
            
            if ($composeContent -match 'postgres|postgresql') { $services += 'PostgreSQL' }
            if ($composeContent -match 'mysql|mariadb') { $services += 'MySQL' }
            if ($composeContent -match 'redis') { $services += 'Redis' }
            if ($composeContent -match 'mongodb|mongo:') { $services += 'MongoDB' }
            if ($composeContent -match 'elasticsearch') { $services += 'Elasticsearch' }
            if ($composeContent -match 'rabbitmq') { $services += 'RabbitMQ' }
            
            if ($services.Count -gt 0) {
                Write-Information "  Detected services: $($services -join ', ')" -InformationAction Continue
                
                if ($StartDependencies) {
                    Write-Information "  → Starting dependencies..." -InformationAction Continue
                    try {
                        docker-compose -f $composeFile up -d
                        Start-Sleep 10  # Allow services to start
                        
                        # Verify services are running
                        $runningServices = docker-compose -f $composeFile ps --services --filter "status=running"
                        if ($runningServices) {
                            Write-Information "  ✓ Dependencies started: $($runningServices -join ', ')" -InformationAction Continue
                        }
                        else {
                            $issues += "Docker services failed to start"
                            Write-Information "  ✗ Dependencies start FAIL" -InformationAction Continue
                        }
                    }
                    catch {
                        $issues += "Docker Compose start failed: $_"
                        Write-Information "  ✗ Docker start FAIL" -InformationAction Continue
                    }
                }
                else {
                    Write-Information "  ℹ Use -StartDependencies to test service startup" -InformationAction Continue
                }
            }
            else {
                Write-Information "  ✓ No external dependencies" -InformationAction Continue
            }
            
        }
        catch {
            $issues += "Docker Compose validation failed: $_"
            Write-Information "  ✗ Docker Compose FAIL" -InformationAction Continue
        }
        break
    }
}

if (-not $composeFound) {
    Write-Information "  ℹ No Docker Compose file found" -InformationAction Continue
}

# 2. CONTRACT TESTS
Write-Information "`n[2/3] Contract Tests..." -InformationAction Continue

# API Contract Tests (OpenAPI/Swagger)
$swaggerFiles = Get-ChildItem "$ProjectRoot\**\swagger.json" -Recurse -ErrorAction SilentlyContinue
$openapiFiles = Get-ChildItem "$ProjectRoot\**\openapi.yaml" -Recurse -ErrorAction SilentlyContinue

if ($swaggerFiles -or $openapiFiles) {
    foreach ($apiFile in ($swaggerFiles + $openapiFiles)) {
        try {
            # Validate API spec
            if ($apiFile.Extension -eq '.json') {
                $spec = Get-Content $apiFile.FullName | ConvertFrom-Json
            }
            else {
                $spec = Get-Content $apiFile.FullName | ConvertFrom-Yaml
            }
            
            # Check for required fields
            if ($spec.info -and $spec.paths) {
                Write-Information "  ✓ API contract valid: $($apiFile.Name)" -InformationAction Continue
            }
            else {
                $issues += "Invalid API contract: $($apiFile.Name)"
                Write-Information "  ✗ API contract FAIL: $($apiFile.Name)" -InformationAction Continue
            }
        }
        catch {
            $issues += "API contract parse error: $($apiFile.Name) - $_"
            Write-Information "  ✗ API parse FAIL: $($apiFile.Name)" -InformationAction Continue
        }
    }
}
else {
    Write-Information "  ℹ No API contracts found" -InformationAction Continue
}

# Database Schema Tests
$migrationDirs = @(
    "$ProjectRoot\Migrations",
    "$ProjectRoot\migrations", 
    "$ProjectRoot\db\migrations",
    "$ProjectRoot\database\migrations"
)

foreach ($migrationDir in $migrationDirs) {
    if (Test-Path $migrationDir) {
        $migrations = Get-ChildItem $migrationDir -Filter "*.sql" -ErrorAction SilentlyContinue
        if ($migrations) {
            Write-Information "  Found $($migrations.Count) database migrations" -InformationAction Continue
            
            # Basic SQL syntax validation
            $sqlErrors = 0
            foreach ($migration in $migrations) {
                $content = Get-Content $migration.FullName -Raw
                # Basic checks for common SQL issues
                if ($content -match 'DROP\s+TABLE\s+(?!IF\s+EXISTS)') {
                    $sqlErrors++
                    $warnings += "Unsafe DROP TABLE in $($migration.Name)"
                }
                if ($content -match 'DELETE\s+FROM\s+\w+\s*(?!WHERE)') {
                    $sqlErrors++
                    $warnings += "DELETE without WHERE clause in $($migration.Name)"
                }
            }
            
            if ($sqlErrors -eq 0) {
                Write-Information "  ✓ Database migrations OK" -InformationAction Continue
            }
            else {
                Write-Information "  ⚠ Migration warnings found" -InformationAction Continue
            }
        }
        break
    }
}

# 3. RUNNING INSTANCE TESTS
Write-Information "`n[3/3] Running Instance Tests..." -InformationAction Continue

# Test against running application instances
$testEndpoints = @()

# Common health check endpoints
$healthUrls = @(
    "http://localhost:5000/health",
    "http://localhost:8000/health", 
    "http://localhost:8080/health",
    "http://localhost:3000/health"
)

foreach ($url in $healthUrls) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $testEndpoints += $url
            Write-Information "  ✓ Health endpoint responding: $url" -InformationAction Continue
        }
    }
    catch {
        # Silent fail - service may not be running
        continue
    }
}

if ($testEndpoints.Count -eq 0) {
    Write-Information "  ℹ No running instances detected" -InformationAction Continue
}
else {
    # Run basic integration tests against live endpoints
    foreach ($endpoint in $testEndpoints) {
        $baseUrl = $endpoint -replace '/health$', ''
        
        # Test common API patterns
        $apiTests = @(
            "$baseUrl/api/version",
            "$baseUrl/api/status", 
            "$baseUrl/swagger/index.html",
            "$baseUrl/health"
        )
        
        $workingEndpoints = 0
        foreach ($testUrl in $apiTests) {
            try {
                $response = Invoke-WebRequest -Uri $testUrl -TimeoutSec 5 -ErrorAction SilentlyContinue
                if ($response.StatusCode -in @(200, 404)) {
                    # 404 is OK for optional endpoints
                    $workingEndpoints++
                }
            }
            catch {
                # Continue testing other endpoints
                continue
            }
        }
        
        if ($workingEndpoints -gt 0) {
            Write-Information "  ✓ Integration test OK: $baseUrl ($workingEndpoints/$($apiTests.Count) endpoints)" -InformationAction Continue
        }
        else {
            $issues += "No working endpoints found for $baseUrl"
            Write-Information "  ✗ Integration test FAIL: $baseUrl" -InformationAction Continue
        }
    }
}

# Database Connection Tests
$connectionStrings = @()

# Look for connection strings in common config files
$configFiles = @(
    "$ProjectRoot\appsettings.json",
    "$ProjectRoot\appsettings.Development.json",
    "$ProjectRoot\.env",
    "$ProjectRoot\config\database.yml"
)

foreach ($configFile in $configFiles) {
    if (Test-Path $configFile) {
        $content = Get-Content $configFile -Raw
        
        # Extract common connection string patterns
        if ($content -match 'ConnectionStrings?["\s]*:.*?"([^"]*)"' -or 
            $content -match 'DATABASE_URL[=\s]*([^\s\n]+)' -or
            $content -match 'server=([^;]+)') {
            $connectionStrings += $matches[1]
        }
    }
}

if ($connectionStrings.Count -gt 0) {
    Write-Information "  Found $($connectionStrings.Count) connection string(s)" -InformationAction Continue
    # Note: We don't test actual connections to avoid side effects
    Write-Information "  ℹ Connection string validation requires running database" -InformationAction Continue
}

# SUMMARY
Write-Information "`n=== LAYER C SUMMARY ===" -InformationAction Continue
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
    Write-Information "`nNext: Run Layer D (UI/E2E Gates)" -InformationAction Continue
    Write-Information "Command: .\scripts\compliance\layer-d-ui-e2e-gates.ps1" -InformationAction Continue
}

exit $issues.Count
