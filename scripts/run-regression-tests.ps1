param(
    [ValidateSet("Quick", "Full", "Web", "All")]
    [string]$Scope = "Quick"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$apiRoot = Join-Path $repoRoot "apps\api"
$webRoot = Join-Path $repoRoot "apps\web"
$anacondaPython = Join-Path $env:USERPROFILE "anaconda3\python.exe"

if (Test-Path -LiteralPath $anacondaPython) {
    $pythonCommand = $anacondaPython
} else {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        throw "Python을 찾을 수 없습니다. Anaconda 또는 Python을 설치한 뒤 다시 실행하세요."
    }
    $pythonCommand = $python.Source
}

function Invoke-Pytest {
    param([string[]]$Targets)

    Push-Location $apiRoot
    try {
        & $pythonCommand -m pytest @Targets -q -rs
        if ($LASTEXITCODE -ne 0) {
            throw "pytest 회귀 테스트가 실패했습니다. 종료 코드: $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Invoke-WebBuild {
    Push-Location $webRoot
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci가 실패했습니다. 종료 코드: $LASTEXITCODE"
        }

        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Web 운영 빌드가 실패했습니다. 종료 코드: $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

$quickTargets = @(
    "tests/test_workspace_context_shared_callers_regression.py",
    "tests/test_bot_configure_ui_contract.py",
    "tests/test_simulator_workspace_context_ui_contract.py"
)

Write-Host "CGA 회귀 테스트 시작: $Scope" -ForegroundColor Cyan

switch ($Scope) {
    "Quick" {
        Invoke-Pytest -Targets $quickTargets
    }
    "Full" {
        Invoke-Pytest -Targets @("tests")
    }
    "Web" {
        Invoke-WebBuild
    }
    "All" {
        Invoke-Pytest -Targets @("tests")
        Invoke-WebBuild
    }
}

Write-Host "CGA 회귀 테스트 완료: PASS" -ForegroundColor Green
