# Venetian Toccata: generate wide, medium, and narrow SVGs
# for every .ly source in ../sources using the existing generate.ps1.
# Run from any directory: .\generate-all.ps1

$ErrorActionPreference = 'Stop'

$generator = Join-Path $PSScriptRoot 'generate.ps1'
$sources = Join-Path $PSScriptRoot '..\sources'

if (-not (Test-Path -LiteralPath $generator -PathType Leaf)) {
    throw "Cannot find generate.ps1 at: $generator"
}
if (-not (Test-Path -LiteralPath $sources -PathType Container)) {
    throw "Cannot find LilyPond sources folder: $sources"
}

$files = @(Get-ChildItem -LiteralPath $sources -File -Filter '*.ly' | Sort-Object Name)
if ($files.Count -eq 0) {
    throw "No .ly files found in: $sources"
}

Write-Host "Found $($files.Count) Venetian .ly source file(s)."
Write-Host 'Each phrase will generate 15 keys x 3 layouts x 2 stages = 90 SVGs.'
Write-Host ''

$completed = 0
foreach ($file in $files) {
    $phraseId = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    Write-Host "[$($completed + 1)/$($files.Count)] Generating $phraseId ..."

    # Use the generator you have already tested successfully.
    & $generator $phraseId

    # The generator calls the native LilyPond executable and throws
    # if LilyPond fails. Stop here if any unexpected native failure occurs.
    if ($LASTEXITCODE -ne 0) {
        throw "Generation failed for $phraseId (exit code $LASTEXITCODE)"
    }

    $completed++
}

Write-Host ''
Write-Host "Finished: $completed phrase(s); expected $($completed * 90) SVGs."
