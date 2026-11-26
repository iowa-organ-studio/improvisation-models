
# =========================================================
# Venetian Toccata - Batch SVG Generator
#
# Generates wide, medium, and narrow SVGs for every .ly
# source in ../sources using generate.ps1.
#
# Usage:
#   .\generate-all.ps1
#   .\generate-all.ps1 ces
#   .\generate-all.ps1 ces,cis
#
# Continues after individual phrase failures and reports
# all failures at the end.
# =========================================================

param(
    [string]$Keys = ''
)

$ErrorActionPreference = 'Stop'

$generator = Join-Path $PSScriptRoot 'generate.ps1'
$sources = Join-Path $PSScriptRoot '..\sources'

# ---------------------------------------------------------
# VALIDATE PATHS
# ---------------------------------------------------------

if (-not (Test-Path -LiteralPath $generator -PathType Leaf)) {
    throw "Cannot find generate.ps1 at: $generator"
}

if (-not (Test-Path -LiteralPath $sources -PathType Container)) {
    throw "Cannot find LilyPond sources folder: $sources"
}

# ---------------------------------------------------------
# FIND SOURCE FILES
# ---------------------------------------------------------

$files = @(
    Get-ChildItem -LiteralPath $sources -File -Filter '*.ly' |
    Sort-Object Name
)

if ($files.Count -eq 0) {
    throw "No .ly files found in: $sources"
}

# ---------------------------------------------------------
# KEY SELECTION
# ---------------------------------------------------------

$validKeys = @(
    'c', 'g', 'f', 'd', 'bes',
    'a', 'ees', 'e', 'aes', 'b',
    'des', 'fis', 'ges', 'cis', 'ces'
)

$selectedKeys = @()

if (-not [string]::IsNullOrWhiteSpace($Keys)) {

    $selectedKeys = @(
        $Keys -split '[,\s]+' |
        Where-Object { $_ } |
        ForEach-Object { $_.ToLowerInvariant() } |
        Select-Object -Unique
    )

    foreach ($key in $selectedKeys) {
        if ($key -notin $validKeys) {
            throw "Invalid key '$key'. Valid keys: $($validKeys -join ', ')"
        }
    }

}
else {
    $selectedKeys = $validKeys
}

$keyCount = $selectedKeys.Count
$expectedPerPhrase = $keyCount * 3 * 2

Write-Host ''
Write-Host '========================================'
Write-Host 'VENETIAN TOCCATA SVG GENERATION'
Write-Host '========================================'
Write-Host "Phrases: $($files.Count)"
Write-Host "Keys: $($selectedKeys -join ', ')"
Write-Host "SVGs per phrase: $expectedPerPhrase"
Write-Host "Expected total: $($files.Count * $expectedPerPhrase)"
Write-Host '========================================'
Write-Host ''

# ---------------------------------------------------------
# GENERATE
# ---------------------------------------------------------

$completed = 0
$failed = 0
$failures = @()

$index = 0

foreach ($file in $files) {

    $index++

    $phraseId =
        [System.IO.Path]::GetFileNameWithoutExtension($file.Name)

    Write-Host ''
    Write-Host "[$index/$($files.Count)] Generating $phraseId ..."
    Write-Host ''

    try {

        # Reset the native exit code before each invocation.
        $global:LASTEXITCODE = 0

        if ([string]::IsNullOrWhiteSpace($Keys)) {
            & $generator $phraseId
        }
        else {
            & $generator $phraseId ($selectedKeys -join ',')
        }

        # A nonzero native exit code is also a failure.
        if ($LASTEXITCODE -ne 0) {
            throw "Generator returned exit code $LASTEXITCODE"
        }

        $completed++

        Write-Host ''
        Write-Host "SUCCESS: $phraseId" -ForegroundColor Green

    }
    catch {

        $failed++

        $message = $_.Exception.Message

        $failures += [PSCustomObject]@{
            Phrase = $phraseId
            Error  = $message
        }

        Write-Host ''
        Write-Host "FAILED: $phraseId" -ForegroundColor Red
        Write-Host $message -ForegroundColor Red
        Write-Host 'Continuing with next phrase...'
    }
}

# ---------------------------------------------------------
# FINAL SUMMARY
# ---------------------------------------------------------

Write-Host ''
Write-Host '========================================'
Write-Host 'GENERATION SUMMARY'
Write-Host '========================================'

Write-Host "Total phrases: $($files.Count)"
Write-Host "Successful:    $completed"
Write-Host "Failed:        $failed"
Write-Host "Expected SVGs from successful phrases: $($completed * $expectedPerPhrase)"

if ($failed -gt 0) {

    Write-Host ''
    Write-Host 'FAILED PHRASES:' -ForegroundColor Red

    foreach ($failure in $failures) {
        Write-Host "  $($failure.Phrase)"
        Write-Host "    $($failure.Error)"
    }

    $logPath = Join-Path $PSScriptRoot 'generate-all-failures.txt'

    $failures |
        Format-List |
        Out-String |
        Set-Content -LiteralPath $logPath -Encoding UTF8

    Write-Host ''
    Write-Host "Failure report saved to: $logPath"
}
else {

    Write-Host ''
    Write-Host 'ALL PHRASES COMPLETED SUCCESSFULLY' -ForegroundColor Green
}

Write-Host '========================================'
Write-Host ''

if ($failed -gt 0) {
    throw "$failed phrase(s) failed. See generation summary above."
}
