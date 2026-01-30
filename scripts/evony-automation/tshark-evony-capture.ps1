# =====================================================
# TSHARK EVONY PACKET CAPTURE
# Capture and analyze Evony network traffic
# =====================================================

param(
    [string]$Interface = "Ethernet",
    [string]$OutputDir = ".\captures",
    [switch]$RealTime
)

Write-Information "==================================================" -InformationAction Continue
Write-Information "EVONY PACKET CAPTURE - TSHARK" -InformationAction Continue
Write-Information "==================================================" -InformationAction Continue
Write-Information "" -InformationAction Continue

# Create output directory
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$captureFile = "$OutputDir\evony_$timestamp.pcap"

# Evony server hosts
$evonyHosts = @(
    "evony.com",
    "www.evony.com",
    "cc1.evony.com",
    "cc2.evony.com",
    "cc3.evony.com",
    "cc4.evony.com",
    "cc5.evony.com"
)

Write-Information "Target hosts: $($evonyHosts -join ', ')" -InformationAction Continue
Write-Information "Output file: $captureFile" -InformationAction Continue
Write-Information "" -InformationAction Continue

# Build capture filter
$hostFilter = ($evonyHosts | ForEach-Object { "host $_" }) -join " or "

if ($RealTime) {
    Write-Information "=== REAL-TIME CAPTURE MODE ===" -InformationAction Continue
    Write-Information "Press Ctrl+C to stop" -InformationAction Continue
    Write-Information "" -InformationAction Continue
    
    # Real-time capture with decoded output
    & tshark -i $Interface -f "($hostFilter) and tcp" -Y "tcp.flags.push == 1" -T fields -e frame.time -e ip.src -e ip.dst -e tcp.srcport -e tcp.dstport -e data.len -e data -l
}
else {
    Write-Information "=== FILE CAPTURE MODE ===" -InformationAction Continue
    Write-Information "Capturing to file... Press Ctrl+C to stop" -InformationAction Continue
    Write-Information "" -InformationAction Continue
    
    # Capture to file
    & tshark -i $Interface -f "($hostFilter) and tcp" -w $captureFile
    
    Write-Information "" -InformationAction Continue
    Write-Information "Capture saved to: $captureFile" -InformationAction Continue
}

# =====================================================
# ANALYSIS COMMANDS (run after capture)
# =====================================================

$analysisScript = @"
# =====================================================
# POST-CAPTURE ANALYSIS
# =====================================================

# View capture summary
tshark -r "$captureFile" -q -z io,stat,1

# Extract data payloads
tshark -r "$captureFile" -Y "tcp.flags.push == 1" -T fields -e data > "$OutputDir\payloads_$timestamp.txt"

# Find potential command strings
tshark -r "$captureFile" -Y "tcp.flags.push == 1" -T fields -e data | ForEach-Object {
    # Convert hex to ASCII where possible
    try {
        `$bytes = [byte[]](`$_ -split '(..)' | Where-Object { `$_ } | ForEach-Object { [Convert]::ToByte(`$_, 16) })
        [System.Text.Encoding]::ASCII.GetString(`$bytes) | Select-String -Pattern "army\.|castle\.|troop\.|quest\." -AllMatches
    } catch {}
}

# Look for specific patterns
Write-Information "=== COMMAND PATTERNS FOUND ==="
Select-String -Path "$OutputDir\payloads_$timestamp.txt" -Pattern "army|castle|troop|quest|login" -AllMatches

"@

Write-Information "" -InformationAction Continue
Write-Information "=== POST-CAPTURE ANALYSIS COMMANDS ===" -InformationAction Continue
Write-Information $analysisScript -InformationAction Continue
