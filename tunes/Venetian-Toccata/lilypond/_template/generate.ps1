# =========================================================
# Venetian Toccata LilyPond SVG Generator
#
# Usage:
#
#   .\generate.ps1 MeruloXI-Vtone-01
#
# Input:
#
#   ../sources/MeruloXI-Vtone-01.ly
#
# Output:
#
#   ../MeruloXI-Vtone-01/
#       c/
#           stage1.svg
#           stage5.svg
#       g/
#           stage1.svg
#           stage5.svg
#       ...
#
# =========================================================

$ErrorActionPreference = "Stop"


# ---------------------------------------------------------
# GET PHRASE ID FROM COMMAND LINE
# ---------------------------------------------------------

if ($args.Count -ne 1) {

    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\generate.ps1 PHRASE_ID"
    Write-Host ""
    Write-Host "Example:"
    Write-Host "  .\generate.ps1 MeruloXI-Vtone-01"
    Write-Host ""

    exit 1
}


$PhraseId = $args[0]


# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

$TemplateDirectory =
    $PSScriptRoot

$SourcesDirectory =
    Join-Path `
        $TemplateDirectory `
        "..\sources"

$Template =
    Join-Path `
        $SourcesDirectory `
        "$PhraseId.ly"

$OutputRoot =
    Join-Path `
        $TemplateDirectory `
        "..\$PhraseId"

$TempRoot =
    Join-Path `
        $env:TEMP `
        "lilypond-intavolatura-$PhraseId"


# ---------------------------------------------------------
# MAJOR KEYS
#
# These are the exact major-key spellings currently
# permitted by the trainer.
#
# These names are also the LilyPond folder names.
# ---------------------------------------------------------

$Keys = @(
    "c",
    "g",
    "f",
    "d",
    "bes",
    "a",
    "ees",
    "e",
    "aes",
    "b",
    "des",
    "fis",
    "ges",
    "cis",
    "ces"
)


# ---------------------------------------------------------
# CHECK SOURCE FILE
# ---------------------------------------------------------

if (!(Test-Path $Template)) {

    throw `
        "Source file not found: $Template"
}


# ---------------------------------------------------------
# PREPARE TEMP DIRECTORY
# ---------------------------------------------------------

if (Test-Path $TempRoot) {

    Remove-Item `
        $TempRoot `
        -Recurse `
        -Force
}

New-Item `
    -ItemType Directory `
    -Path $TempRoot `
    | Out-Null


# ---------------------------------------------------------
# READ SOURCE FILE
# ---------------------------------------------------------

$templateText =
    Get-Content `
        -Path $Template `
        -Raw


# ---------------------------------------------------------
# GENERATE ALL KEYS × ALL STAGES
# ---------------------------------------------------------

foreach ($keyName in $Keys) {

    $outputDir =
        Join-Path `
            $OutputRoot `
            $keyName

    if (!(Test-Path $outputDir)) {

        New-Item `
            -ItemType Directory `
            -Path $outputDir `
            | Out-Null
    }


    foreach ($stage in @(1, 5)) {

        Write-Host ""
        Write-Host "========================================"
        Write-Host "Phrase: $PhraseId"
        Write-Host "Key:    $keyName"
        Write-Host "Stage:  $stage"
        Write-Host "========================================"


        # -------------------------------------------------
        # START FROM THE ORIGINAL PHRASE SOURCE
        # -------------------------------------------------

        $source =
            $templateText


        # -------------------------------------------------
        # REPLACE TARGET_KEY
        # -------------------------------------------------

        $source =
            $source.Replace(
                "TARGET_KEY",
                $keyName
            )


        # -------------------------------------------------
        # REPLACE STAGE
        # -------------------------------------------------

        $source =
            [regex]::Replace(
                $source,
                '(?m)^\s*#\(define stage [1-5]\).*$',
                "#(define stage $stage)"
            )


        # -------------------------------------------------
        # TEMPORARY LILYPOND SOURCE
        # -------------------------------------------------

        $tempLy =
            Join-Path `
                $TempRoot `
                "$keyName-stage$stage.ly"

        Set-Content `
            -Path $tempLy `
            -Value $source `
            -Encoding UTF8


        # -------------------------------------------------
        # LILYPOND OUTPUT BASENAME
        # -------------------------------------------------

        $outputBase =
            Join-Path `
                $TempRoot `
                "$keyName-stage$stage"


        # -------------------------------------------------
        # RUN LILYPOND
        # -------------------------------------------------

      & lilypond `
    --svg `
    -o $outputBase `
    $tempLy

        if ($LASTEXITCODE -ne 0) {

            throw `
                "LilyPond failed for $PhraseId / $keyName / stage $stage"
        }


        # -------------------------------------------------
        # FIND CROPPED SVG
        # -------------------------------------------------

       $croppedSvg =
    "$outputBase.svg"

        if (!(Test-Path $croppedSvg)) {

            throw `
                "Cropped SVG not found: $croppedSvg"
        }


        # -------------------------------------------------
        # COPY INTO FINAL LOCATION
        # -------------------------------------------------

        $finalSvg =
            Join-Path `
                $outputDir `
                "stage$stage.svg"

        Copy-Item `
            -Path $croppedSvg `
            -Destination $finalSvg `
            -Force


        Write-Host ""
        Write-Host "Created:"
        Write-Host "  $finalSvg"
    }
}


# ---------------------------------------------------------
# CLEANUP
# ---------------------------------------------------------

Remove-Item `
    $TempRoot `
    -Recurse `
    -Force


Write-Host ""
Write-Host "========================================"
Write-Host "DONE"
Write-Host "========================================"
Write-Host ""
Write-Host "Phrase:"
Write-Host "  $PhraseId"
Write-Host ""
Write-Host "Output:"
Write-Host "  $OutputRoot"
Write-Host ""