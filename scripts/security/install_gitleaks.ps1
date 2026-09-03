[CmdletBinding()]
param(
    [Parameter()]
    [string]$Destination = ".local/security/gitleaks"
)

$ErrorActionPreference = "Stop"
$version = "8.30.1"
$archiveName = "gitleaks_${version}_windows_x64.zip"
$releaseBase = "https://github.com/gitleaks/gitleaks/releases/download/v$version"
$checksumsDigest = "061476c21adaf5441516f96f185c1a4706a83cd6329b9b38762271b3d4a52fae"
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("cga-gitleaks-" + [guid]::NewGuid().ToString("N"))

try {
    $null = New-Item -ItemType Directory -Path $temporaryRoot
    $checksumsPath = Join-Path $temporaryRoot "gitleaks_checksums.txt"
    $archivePath = Join-Path $temporaryRoot $archiveName
    $extractPath = Join-Path $temporaryRoot "extract"

    Invoke-WebRequest -Uri "$releaseBase/gitleaks_${version}_checksums.txt" -OutFile $checksumsPath
    $actualChecksumsDigest = (Get-FileHash -Algorithm SHA256 -LiteralPath $checksumsPath).Hash.ToLowerInvariant()
    if ($actualChecksumsDigest -ne $checksumsDigest) {
        throw "Gitleaks checksum manifest verification failed."
    }

    $escapedArchiveName = [regex]::Escape($archiveName)
    $manifestLine = Select-String -LiteralPath $checksumsPath -Pattern "^([0-9a-fA-F]{64})\s+$escapedArchiveName$" | Select-Object -First 1
    if (-not $manifestLine) {
        throw "Gitleaks archive checksum is missing from the verified manifest."
    }
    $expectedArchiveDigest = $manifestLine.Matches[0].Groups[1].Value.ToLowerInvariant()

    Invoke-WebRequest -Uri "$releaseBase/$archiveName" -OutFile $archivePath
    $actualArchiveDigest = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
    if ($actualArchiveDigest -ne $expectedArchiveDigest) {
        throw "Gitleaks archive verification failed."
    }

    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath
    $resolvedDestination = [IO.Path]::GetFullPath($Destination)
    $null = New-Item -ItemType Directory -Path $resolvedDestination -Force
    Copy-Item -LiteralPath (Join-Path $extractPath "gitleaks.exe") -Destination (Join-Path $resolvedDestination "gitleaks.exe") -Force
    Write-Output (Join-Path $resolvedDestination "gitleaks.exe")
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
