# Doctor Script - Prerequisites and Environment Validation
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
param(
    [switch]$Fix = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = 'Stop'

Write-Information "=== SVONY BROWSER - SYSTEM DOCTOR ===" -InformationAction Continue
Write-Information "Checking prerequisites and environment..." -InformationAction Continue

$checks = @()
$failures = @()
$warnings = @()

# 1. OPERATING SYSTEM CHECK
Write-Information "`n[1/10] Operating System..." -InformationAction Continue
try {
    # Primary method - Get RAM from Win32_PhysicalMemory (most reliable)
    $ramBytes = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
    $ramGB = [math]::Round($ramBytes / 1GB, 1)
    
    # Get OS info separately
    $osInfo = Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion
} catch {
    try {
        # Fallback method using WMI
        $ramBytes = (Get-WmiObject Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
        $ramGB = [math]::Round($ramBytes / 1GB, 1)
        $osInfo = @{
            WindowsProductName = "Windows (version detection failed)"
            WindowsVersion = [System.Environment]::OSVersion.Version.ToString()
        }
    } catch {
        $ramGB = 0
        $osInfo = @{
            WindowsProductName = "Windows (detection failed)"
            WindowsVersion = "Unknown"
        }
    }
}

Write-Information "  OS: $($osInfo.WindowsProductName)" -InformationAction Continue
Write-Information "  Version: $($osInfo.WindowsVersion)" -InformationAction Continue
Write-Information "  RAM: $ramGB GB" -InformationAction Continue

if ([System.Environment]::OSVersion.Version.Major -ge 10) {
    $checks += "✓ Windows 10/11 detected"
    Write-Information "  ✓ Compatible Windows version" -InformationAction Continue
}
else {
    $failures += "Windows 10 or higher required"
    Write-Information "  ✗ Incompatible Windows version" -InformationAction Continue
}

if ($ramGB -ge 8) {
    $checks += "✓ Sufficient RAM ($ramGB GB)"
    Write-Information "  ✓ Sufficient RAM" -InformationAction Continue
}
else {
    $warnings += "Low RAM detected ($ramGB GB) - 8GB+ recommended"
    Write-Information "  ⚠ Low RAM" -InformationAction Continue
}

# 2. .NET RUNTIME CHECK
Write-Information "`n[2/10] .NET Runtime..." -InformationAction Continue
try {
    $dotnetVersion = dotnet --version
    Write-Information "  Installed: $dotnetVersion" -InformationAction Continue
    
    # Check if version is 6.0 or higher (required for modern C#)
    if ([Version]$dotnetVersion.Split('-')[0] -ge [Version]"6.0") {
        $checks += "✓ .NET 6.0+ detected ($dotnetVersion)"
        Write-Information "  ✓ .NET runtime OK" -InformationAction Continue
    }
    else {
        $failures += ".NET 6.0 or higher required (found: $dotnetVersion)"
        Write-Information "  ✗ .NET version too old" -InformationAction Continue
    }
}
catch {
    $failures += ".NET runtime not found or not in PATH"
    Write-Information "  ✗ .NET runtime missing" -InformationAction Continue
    
    if ($Fix) {
        Write-Information "  → Installing .NET 8.0..." -InformationAction Continue
        try {
            Invoke-WebRequest -Uri "https://dot.net/v1/dotnet-install.ps1" -OutFile "dotnet-install.ps1"
            .\dotnet-install.ps1 -Channel 8.0
            Remove-Item "dotnet-install.ps1"
            Write-Information "  ✓ .NET 8.0 installed" -InformationAction Continue
        }
        catch {
            Write-Information "  ✗ Auto-install failed - manual installation required" -InformationAction Continue
        }
    }
}

# 3. NODE.JS CHECK (for frontend/tooling)
Write-Information "`n[3/10] Node.js..." -InformationAction Continue
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Information "  Node: $nodeVersion" -InformationAction Continue
    Write-Information "  NPM: $npmVersion" -InformationAction Continue
    
    # Check for Node 18+
    $nodeVersionNum = [Version]$nodeVersion.Substring(1).Split('-')[0]
    if ($nodeVersionNum -ge [Version]"18.0") {
        $checks += "✓ Node.js 18+ detected ($nodeVersion)"
        Write-Information "  ✓ Node.js version OK" -InformationAction Continue
    }
    else {
        $warnings += "Node.js 18+ recommended for best compatibility (found: $nodeVersion)"
        Write-Information "  ⚠ Old Node.js version" -InformationAction Continue
    }
}
catch {
    $warnings += "Node.js not found - some tooling may not work"
    Write-Information "  ⚠ Node.js not found" -InformationAction Continue
}

# 4. GIT CHECK
Write-Information "`n[4/10] Git..." -InformationAction Continue
try {
    $gitVersion = git --version
    Write-Information "  Version: $gitVersion" -InformationAction Continue
    $checks += "✓ Git available"
    Write-Information "  ✓ Git OK" -InformationAction Continue
    
    # Check git config
    try {
        $gitUser = git config user.name
        $gitEmail = git config user.email
        if ($gitUser -and $gitEmail) {
            Write-Information "  User: $gitUser <$gitEmail>" -InformationAction Continue
            $checks += "✓ Git configured"
        }
        else {
            $warnings += "Git user/email not configured"
            Write-Information "  ⚠ Git not configured" -InformationAction Continue
        }
    }
    catch {
        $warnings += "Git configuration check failed"
    }
}
catch {
    $failures += "Git not found or not in PATH"
    Write-Information "  ✗ Git missing" -InformationAction Continue
}

# 5. DOCKER CHECK
Write-Information "`n[5/10] Docker..." -InformationAction Continue
try {
    $dockerVersion = docker --version
    Write-Information "  Version: $dockerVersion" -InformationAction Continue
    
    # Check if Docker daemon is running
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $checks += "✓ Docker running"
        Write-Information "  ✓ Docker OK" -InformationAction Continue
    }
    else {
        $warnings += "Docker installed but not running"
        Write-Information "  ⚠ Docker not running" -InformationAction Continue
    }
}
catch {
    $warnings += "Docker not found - containerization features unavailable"
    Write-Information "  ⚠ Docker not found" -InformationAction Continue
}

# 6. POWERSHELL VERSION CHECK
Write-Information "`n[6/10] PowerShell..." -InformationAction Continue
$psVersion = $PSVersionTable.PSVersion
Write-Information "  Version: $psVersion" -InformationAction Continue

if ($psVersion.Major -ge 5) {
    $checks += "✓ PowerShell 5.0+ detected"
    Write-Information "  ✓ PowerShell version OK" -InformationAction Continue
}
else {
    $failures += "PowerShell 5.0 or higher required"
    Write-Information "  ✗ PowerShell too old" -InformationAction Continue
}

# 7. CHROME/EDGE CHECK (for testing)
Write-Information "`n[7/10] Browser (for testing)..." -InformationAction Continue
$browsers = @()

# Check Chrome
try {
    $chromePath = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue
    if ($chromePath) {
        $browsers += "Chrome"
    }
}
catch { 
    continue
}

# Check Edge
try {
    $edgePath = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" -ErrorAction SilentlyContinue
    if ($edgePath) {
        $browsers += "Edge"
    }
}
catch { 
    continue
}

if ($browsers.Count -gt 0) {
    $checks += "✓ Browsers available: $($browsers -join ', ')"
    Write-Information "  ✓ Browsers: $($browsers -join ', ')" -InformationAction Continue
}
else {
    $warnings += "No supported browsers found for automated testing"
    Write-Information "  ⚠ No browsers found" -InformationAction Continue
}

# 8. PORTS CHECK
Write-Information "`n[8/10] Port Availability..." -InformationAction Continue
$requiredPorts = @(8080, 5000, 3000, 8081, 3306)
$busyPorts = @()

foreach ($port in $requiredPorts) {
    $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($connection.TcpTestSucceeded) {
        $busyPorts += $port
    }
}

if ($busyPorts.Count -eq 0) {
    $checks += "✓ All required ports available"
    Write-Information "  ✓ Ports available: $($requiredPorts -join ', ')" -InformationAction Continue
}
else {
    $warnings += "Ports in use: $($busyPorts -join ', ') - may cause conflicts"
    Write-Information "  ⚠ Busy ports: $($busyPorts -join ', ')" -InformationAction Continue
}

# 9. DISK SPACE CHECK
Write-Information "`n[9/10] Disk Space..." -InformationAction Continue
try {
    $currentDrive = (Get-Location).Drive.Name + ":"
    $drive = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$currentDrive'"
    if ($drive) {
        $freeSpaceGB = [math]::Round($drive.FreeSpace / 1GB, 1)
        $totalSpaceGB = [math]::Round($drive.Size / 1GB, 1)
    } else {
        throw "CIM query failed"
    }
} catch {
    try {
        # Fallback using Get-PSDrive
        $currentDrive = (Get-Location).Drive.Name
        $driveInfo = Get-PSDrive -Name $currentDrive -PSProvider FileSystem
        if ($driveInfo) {
            $freeSpaceGB = [math]::Round($driveInfo.Free / 1GB, 1)
            $totalSpaceGB = [math]::Round(($driveInfo.Used + $driveInfo.Free) / 1GB, 1)
        } else {
            throw "PSDrive query failed"
        }
    } catch {
        # Final fallback using WMI
        $currentDrive = (Get-Location).Drive.Name + ":"
        $drive = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='$currentDrive'"
        if ($drive) {
            $freeSpaceGB = [math]::Round($drive.FreeSpace / 1GB, 1)
            $totalSpaceGB = [math]::Round($drive.Size / 1GB, 1)
        } else {
            $freeSpaceGB = 0
            $totalSpaceGB = 0
        }
    }
}

Write-Information "  Drive $currentDrive`: $freeSpaceGB GB free of $totalSpaceGB GB" -InformationAction Continue

if ($freeSpaceGB -gt 10) {
    $checks += "✓ Sufficient disk space ($freeSpaceGB GB free)"
    Write-Information "  ✓ Sufficient disk space" -InformationAction Continue
}
else {
    $warnings += "Low disk space ($freeSpaceGB GB free) - 10GB+ recommended"
    Write-Information "  ⚠ Low disk space" -InformationAction Continue
}

# 10. PROJECT DEPENDENCIES CHECK
Write-Information "`n[10/10] Project Dependencies..." -InformationAction Continue
$projectRoot = Split-Path $PSScriptRoot -Parent

# Check for solution file
if (Test-Path "$projectRoot\*.sln") {
    Write-Information "  ✓ Solution file found" -InformationAction Continue
    $checks += "✓ .NET solution detected"
}
else {
    $warnings += "No .sln file found - manual project setup may be required"
    Write-Information "  ⚠ No solution file" -InformationAction Continue
}

# Check for package dependencies (Node.js, .NET, etc.)
$hasNodeDeps = Test-Path "$projectRoot\package.json"
$hasNuGetDeps = (Test-Path "$projectRoot\packages.config") -or (Get-ChildItem "$projectRoot\*.csproj" -ErrorAction SilentlyContinue | ForEach-Object { Get-Content $_ | Select-String "PackageReference" })

if ($hasNodeDeps -or $hasNuGetDeps) {
    if ($hasNodeDeps) {
        Write-Information "  ✓ Node.js dependencies (package.json) found" -InformationAction Continue
        $checks += "✓ Node.js package dependencies found"
    }
    if ($hasNuGetDeps) {
        Write-Information "  ✓ NuGet dependencies configured" -InformationAction Continue
        $checks += "✓ .NET package dependencies found"
    }
}
else {
    $warnings += "No package dependencies found - expected package.json or NuGet packages"
    Write-Information "  ⚠ No package dependencies" -InformationAction Continue
}

# Check for Docker Compose
if (Test-Path "$projectRoot\docker-compose.yml") {
    Write-Information "  ✓ Docker Compose configuration found" -InformationAction Continue
    $checks += "✓ Docker Compose configured"
}
else {
    Write-Information "  ℹ No Docker Compose file" -InformationAction Continue
}

# SUMMARY
Write-Information "`n" + "="*60 -InformationAction Continue
Write-Information "DOCTOR SUMMARY" -InformationAction Continue
Write-Information "="*60 -InformationAction Continue

Write-Information "`nCHECKS PASSED: $($checks.Count)" -InformationAction Continue
if ($Verbose -and $checks.Count -gt 0) {
    foreach ($check in $checks) {
        Write-Information "  $check" -InformationAction Continue
    }
}

Write-Information "`nWARNINGS: $($warnings.Count)" -InformationAction Continue
if ($warnings.Count -gt 0) {
    foreach ($warning in $warnings) {
        Write-Information "  ⚠ $warning" -InformationAction Continue
    }
}

Write-Information "`nFAILURES: $($failures.Count)" -InformationAction Continue
if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Information "  ✗ $failure" -InformationAction Continue
    }
}

# RECOMMENDATIONS
if ($failures.Count -gt 0 -or $warnings.Count -gt 0) {
    Write-Information "`nRECOMMENDATIONS:" -InformationAction Continue
    
    if ($failures.Count -gt 0) {
        Write-Information "  1. Fix critical failures before proceeding" -InformationAction Continue
        Write-Information "     Run: .\scripts\doctor.ps1 -Fix (attempts auto-fixes)" -InformationAction Continue
    }
    
    if ($warnings.Count -gt 0) {
        Write-Information "  2. Address warnings for optimal experience" -InformationAction Continue
    }
    
    Write-Information "  3. Run again after fixes: .\scripts\doctor.ps1 -Verbose" -InformationAction Continue
}

# NEXT STEPS
Write-Information "`nNEXT STEPS:" -InformationAction Continue
if ($failures.Count -eq 0) {
    Write-Information "  ✓ Environment ready! Run: .\scripts\run-dev.ps1" -InformationAction Continue
}
else {
    Write-Information "  ✗ Fix $($failures.Count) critical issue(s) before continuing" -InformationAction Continue
}

exit $failures.Count
