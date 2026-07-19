param(
    [int]$WebPort = 5173,
    [int]$ApiPort = 8320
)

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw "PowerShell 7 이상에서 실행해 주세요: pwsh -File .\scripts\start-local.ps1"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $projectRoot "apps\web"
$logRoot = Join-Path $projectRoot ".local\logs"

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

function Test-ListeningPort {
    param([int]$Port)
    return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-HttpReady {
    param(
        [string]$Uri,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

if (-not (Test-ListeningPort -Port $ApiPort)) {
    throw "기존 Aidot API가 실행 중이 아닙니다: http://127.0.0.1:$ApiPort"
}

$node = (Get-Command node.exe -ErrorAction Stop).Source

if (-not (Test-ListeningPort -Port $WebPort)) {
    $webProcess = @{
        FilePath = $node
        ArgumentList = @("node_modules\next\dist\bin\next", "dev", "--webpack", "--hostname", "0.0.0.0", "--port", "$WebPort")
        WorkingDirectory = $webRoot
        WindowStyle = "Hidden"
        Environment = @{
            NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:$ApiPort"
        }
        RedirectStandardOutput = (Join-Path $logRoot "web-$WebPort.out.log")
        RedirectStandardError = (Join-Path $logRoot "web-$WebPort.err.log")
    }
    Start-Process @webProcess
}

$apiReady = Wait-HttpReady -Uri "http://127.0.0.1:$ApiPort/"
$webReady = Wait-HttpReady -Uri "http://127.0.0.1:$WebPort/login"

[pscustomobject]@{
    Api = if ($apiReady) { "http://127.0.0.1:$ApiPort" } else { "not-ready" }
    Web = if ($webReady) { "http://127.0.0.1:$WebPort/login" } else { "not-ready" }
    LogDirectory = $logRoot
} | Format-List

if (-not $apiReady -or -not $webReady) {
    exit 1
}
