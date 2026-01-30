# =====================================================
# POWERSHELL ERROR HANDLING UTILITIES
# Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
# =====================================================

# Advanced Error Handling Functions for PowerShell Scripts
# SvonyBrowser v2.2.13

function Initialize-ErrorHandler {
    param(
        [string]$LogPath = "logs\powershell-errors.log",
        [switch]$EnableVerbose
    )
    
    $script:ErrorLogPath = $LogPath
    $script:VerboseLogging = $EnableVerbose
    $script:SessionId = "PS-" + (Get-Date -Format "yyyyMMdd-HHmmss") + "-" + (Get-Random -Maximum 9999)
    
    # Ensure log directory exists
    $logDir = Split-Path $script:ErrorLogPath -Parent
    if ($logDir -and -not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    Write-Information "Error handler initialized - Session: $script:SessionId" -InformationAction Continue
}

function Write-ErrorLog {
    param(
        [Parameter(Mandatory)]
        [string]$Message,
        
        [Parameter(Mandatory)]
        [ValidateSet('Info', 'Warning', 'Error', 'Fatal')]
        [string]$Severity,
        
        [hashtable]$Context = @{},
        
        [string]$ErrorType = 'GENERAL',
        
        [System.Management.Automation.ErrorRecord]$ErrorRecord = $null
    )
    
    $logEntry = @{
        Timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        SessionId = $script:SessionId
        Severity = $Severity
        ErrorType = $ErrorType
        Message = $Message
        Context = $Context
        ScriptName = $MyInvocation.ScriptName
        LineNumber = $MyInvocation.ScriptLineNumber
        CommandName = $MyInvocation.MyCommand.Name
        PSVersion = $PSVersionTable.PSVersion.ToString()
        Platform = [System.Environment]::OSVersion.Platform
        MachineName = $env:COMPUTERNAME
    }
    
    if ($ErrorRecord) {
        $logEntry.Exception = @{
            Type = $ErrorRecord.Exception.GetType().Name
            Message = $ErrorRecord.Exception.Message
            StackTrace = $ErrorRecord.ScriptStackTrace
            InnerException = if ($ErrorRecord.Exception.InnerException) { 
                $ErrorRecord.Exception.InnerException.Message 
            } else { $null }
        }
    }
    
    # Write to console with color coding
    $color = switch ($Severity) {
        'Info' { 'Green' }
        'Warning' { 'Yellow' }  
        'Error' { 'Red' }
        'Fatal' { 'DarkRed' }
    }
    
    $prefix = "[$Severity]".PadRight(9)
    Write-Information "$prefix $Message" -InformationAction Continue
    
    if ($script:VerboseLogging -and $Context.Count -gt 0) {
        Write-Information "          Context: $($Context | ConvertTo-Json -Compress)" -InformationAction Continue
    }
    
    # Write to log file
    if ($script:ErrorLogPath) {
        try {
            $jsonLog = $logEntry | ConvertTo-Json -Compress
            Add-Content -Path $script:ErrorLogPath -Value $jsonLog -Encoding UTF8
        }
        catch {
            Write-Warning "Failed to write to error log: $_"
        }
    }
    
    # Handle fatal errors
    if ($Severity -eq 'Fatal') {
        Write-Information "FATAL ERROR ENCOUNTERED - TERMINATING SCRIPT" -InformationAction Continue
        throw "Fatal error: $Message"
    }
}

function Invoke-WithErrorHandling {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$ScriptBlock,
        
        [string]$Operation = 'Operation',
        
        [hashtable]$Context = @{},
        
        [switch]$ThrowOnError,
        
        [int]$MaxRetries = 0,
        
        [int]$RetryDelaySeconds = 1
    )
    
    $attempt = 0
    $maxAttempts = $MaxRetries + 1
    
    do {
        $attempt++
        try {
            Write-ErrorLog -Message "Starting $Operation (Attempt $attempt/$maxAttempts)" -Severity 'Info' -ErrorType 'OPERATION_START' -Context ($Context + @{Attempt = $attempt})
            
            $result = & $ScriptBlock
            
            Write-ErrorLog -Message "$Operation completed successfully" -Severity 'Info' -ErrorType 'OPERATION_SUCCESS' -Context ($Context + @{Attempt = $attempt})
            
            return $result
        }
        catch {
            $errorContext = $Context + @{
                Attempt = $attempt
                MaxAttempts = $maxAttempts
                Operation = $Operation
            }
            
            if ($attempt -lt $maxAttempts) {
                Write-ErrorLog -Message "$Operation failed (attempt $attempt/$maxAttempts): $($_.Exception.Message)" -Severity 'Warning' -ErrorType 'OPERATION_RETRY' -Context $errorContext -ErrorRecord $_
                
                if ($RetryDelaySeconds -gt 0) {
                    Start-Sleep -Seconds $RetryDelaySeconds
                }
            }
            else {
                $severity = if ($ThrowOnError) { 'Fatal' } else { 'Error' }
                Write-ErrorLog -Message "$Operation failed after $maxAttempts attempts: $($_.Exception.Message)" -Severity $severity -ErrorType 'OPERATION_FAILED' -Context $errorContext -ErrorRecord $_
                
                if ($ThrowOnError) {
                    throw
                }
                return $null
            }
        }
    } while ($attempt -lt $maxAttempts)
}

function Test-Prerequisites {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Prerequisites,
        
        [switch]$ThrowOnFailure
    )
    
    $failed = @()
    
    foreach ($prereq in $Prerequisites.GetEnumerator()) {
        $name = $prereq.Key
        $check = $prereq.Value
        
        try {
            Write-ErrorLog -Message "Checking prerequisite: $name" -Severity 'Info' -ErrorType 'PREREQUISITE_CHECK'
            
            $result = & $check
            if (-not $result) {
                throw "Prerequisite check returned false"
            }
            
            Write-ErrorLog -Message "Prerequisite '$name' satisfied" -Severity 'Info' -ErrorType 'PREREQUISITE_OK' -Context @{Prerequisite = $name}
        }
        catch {
            $failed += $name
            Write-ErrorLog -Message "Prerequisite '$name' failed: $($_.Exception.Message)" -Severity 'Error' -ErrorType 'PREREQUISITE_FAILED' -Context @{Prerequisite = $name} -ErrorRecord $_
        }
    }
    
    if ($failed.Count -gt 0) {
        $message = "Prerequisites failed: $($failed -join ', ')"
        $severity = if ($ThrowOnFailure) { 'Fatal' } else { 'Error' }
        Write-ErrorLog -Message $message -Severity $severity -ErrorType 'PREREQUISITES_FAILED' -Context @{FailedPrerequisites = $failed}
        
        return $false
    }
    
    return $true
}

function Get-ErrorStatistics {
    param(
        [string]$LogPath = $script:ErrorLogPath,
        [int]$HoursBack = 24
    )
    
    if (-not (Test-Path $LogPath)) {
        Write-ErrorLog -Message "Error log file not found: $LogPath" -Severity 'Warning' -ErrorType 'LOG_FILE_MISSING'
        return $null
    }
    
    try {
        $cutoffTime = (Get-Date).AddHours(-$HoursBack)
        $logEntries = Get-Content $LogPath | ForEach-Object {
            try {
                $entry = $_ | ConvertFrom-Json
                if ([DateTime]::Parse($entry.Timestamp) -gt $cutoffTime) {
                    $entry
                }
            }
            catch {
                # Skip malformed entries
            }
        }
        
        $statistics = @{
            TotalEntries = $logEntries.Count
            BySeverity = $logEntries | Group-Object Severity | ForEach-Object { @{$_.Name = $_.Count} } | Merge-HashTables
            ByErrorType = $logEntries | Group-Object ErrorType | Sort-Object Count -Descending | Select-Object -First 10 | ForEach-Object { @{$_.Name = $_.Count} } | Merge-HashTables
            TimeRange = @{
                From = $cutoffTime
                To = Get-Date
                HoursBack = $HoursBack
            }
            SessionIds = ($logEntries | Group-Object SessionId | Measure-Object).Count
        }
        
        return $statistics
    }
    catch {
        Write-ErrorLog -Message "Failed to generate error statistics: $($_.Exception.Message)" -Severity 'Error' -ErrorType 'STATISTICS_FAILED' -ErrorRecord $_
        return $null
    }
}

function Merge-HashTables {
    param(
        [Parameter(ValueFromPipeline)]
        [hashtable]$InputObject
    )
    
    begin {
        $result = @{}
    }
    
    process {
        foreach ($key in $InputObject.Keys) {
            $result[$key] = $InputObject[$key]
        }
    }
    
    end {
        return $result
    }
}

function Start-PerformanceMonitor {
    param(
        [string]$Operation,
        [hashtable]$Context = @{}
    )
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    Write-ErrorLog -Message "Performance monitoring started for: $Operation" -Severity 'Info' -ErrorType 'PERFORMANCE_START' -Context ($Context + @{Operation = $Operation})
    
    return @{
        Operation = $Operation
        StartTime = Get-Date
        Stopwatch = $stopwatch
        Context = $Context
    }
}

function Stop-PerformanceMonitor {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Monitor,
        
        [hashtable]$AdditionalContext = @{}
    )
    
    $Monitor.Stopwatch.Stop()
    $duration = $Monitor.Stopwatch.Elapsed
    
    $context = $Monitor.Context + $AdditionalContext + @{
        Duration = $duration.ToString()
        DurationMs = $duration.TotalMilliseconds
        StartTime = $Monitor.StartTime
        EndTime = Get-Date
    }
    
    $severity = if ($duration.TotalSeconds -gt 30) { 'Warning' } else { 'Info' }
    Write-ErrorLog -Message "Performance monitoring completed for: $($Monitor.Operation)" -Severity $severity -ErrorType 'PERFORMANCE_END' -Context $context
    
    return $context
}

# Export functions for use in other scripts
Export-ModuleMember -Function @(
    'Initialize-ErrorHandler',
    'Write-ErrorLog', 
    'Invoke-WithErrorHandling',
    'Test-Prerequisites',
    'Get-ErrorStatistics',
    'Start-PerformanceMonitor',
    'Stop-PerformanceMonitor'
)
