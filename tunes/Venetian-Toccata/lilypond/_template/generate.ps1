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
# PITCH HELPERS
# ---------------------------------------------------------

function GetPitchInfo {

    param(
        [string]$Pitch
    )

    $match =
        [regex]::Match(
            $Pitch,
            '^([a-g])(is|es)?$'
        )

    if (!$match.Success) {

        throw `
            "Unrecognized LilyPond pitch: $Pitch"
    }

    $letter =
        $match.Groups[1].Value

    $accidental =
        $match.Groups[2].Value


    $pitchClassByLetter = @{
        c = 0
        d = 2
        e = 4
        f = 5
        g = 7
        a = 9
        b = 11
    }


    $letterIndex = @{
        c = 0
        d = 1
        e = 2
        f = 3
        g = 4
        a = 5
        b = 6
    }


    $pitchClass =
        $pitchClassByLetter[$letter]


    if ($accidental -eq "is") {

        $pitchClass++
    }

    elseif ($accidental -eq "es") {

        $pitchClass--
    }


    $pitchClass =
        (($pitchClass % 12) + 12) % 12


    return @{
        Letter      = $letter
        Accidental  = $accidental
        PitchClass  = $pitchClass
        LetterIndex = $letterIndex[$letter]
    }
}


function GetTransposeTarget {

    param(
        [string]$SourcePitch,
        [string]$TargetPitch
    )


    $source =
        GetPitchInfo $SourcePitch

    $target =
        GetPitchInfo $TargetPitch


    # -----------------------------------------------------
    # Calculate shortest chromatic interval.
    #
    # Normally this gives:
    #
    #   -5 through +6
    #
    # The tritone is handled separately below.
    # -----------------------------------------------------

    $interval =
        $target.PitchClass -
        $source.PitchClass


    while ($interval -gt 6) {

        $interval -= 12
    }

    while ($interval -lt -6) {

        $interval += 12
    }


    # -----------------------------------------------------
    # Tritone:
    #
    # Use the spelling to decide direction.
    #
    # C -> F#  = augmented 4th = UP
    # C -> Gb  = diminished 5th = DOWN
    #
    # More generally, if the target letter is a 4th or
    # closer above the source letter, use +6.
    # If it is a 5th/6th/7th, use -6.
    # -----------------------------------------------------

    if (
        [Math]::Abs($interval) -eq 6
    ) {

        $diatonicDistance =
            (
                $target.LetterIndex -
                $source.LetterIndex +
                7
            ) % 7


        if ($diatonicDistance -le 3) {

            $interval = 6
        }
        else {

            $interval = -6
        }
    }


    # -----------------------------------------------------
    # LilyPond needs octave marks to tell it whether the
    # target is above or below the source.
    #
    # Example:
    #
    #   c -> b
    #
    # same-octave B is +11 semitones.
    # Desired interval is -1.
    #
    # Therefore LilyPond needs:
    #
    #   b,
    #
    # -----------------------------------------------------

    $sameOctaveDifference =
        $target.PitchClass -
        $source.PitchClass


    $octaveAdjustment =
        (
            $interval -
            $sameOctaveDifference
        ) / 12


    if (
        $octaveAdjustment -ne
        [Math]::Floor($octaveAdjustment)
    ) {

        throw `
            "Could not calculate LilyPond octave adjustment for $SourcePitch -> $TargetPitch"
    }


    $octaveAdjustment =
        [int]$octaveAdjustment


    $result =
        $target.Letter +
        $target.Accidental


    if ($octaveAdjustment -gt 0) {

        $result +=
            ("'" * $octaveAdjustment)
    }

    elseif ($octaveAdjustment -lt 0) {

        $result +=
            ("," * (-$octaveAdjustment))
    }


    return $result
}


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
# GET SOURCE PITCH FROM THE TEMPLATE
#
# The template should contain something like:
#
#   \transpose c TARGET_KEY {
#
# or:
#
#   \transpose f TARGET_KEY {
#
# We preserve that source pitch and only calculate the
# replacement for TARGET_KEY.
# ---------------------------------------------------------

$transposeMatch =
    [regex]::Match(
        $templateText,
        '\\transpose\s+([a-g](?:is|es)?)\s+TARGET_KEY'
    )


if (!$transposeMatch.Success) {

    throw `
        "Could not find '\transpose SOURCE TARGET_KEY' in ${Template}"
}


$sourcePitch =
    $transposeMatch.Groups[1].Value


Write-Host ""
Write-Host "Source transpose pitch: $sourcePitch"
Write-Host ""


# ---------------------------------------------------------
# GENERATE ALL KEYS x ALL STAGES
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


    # -----------------------------------------------------
    # CALCULATE THE ACTUAL LILYPOND TARGET PITCH
    # -----------------------------------------------------

    $transposeTarget =
        GetTransposeTarget `
            -SourcePitch $sourcePitch `
            -TargetPitch $keyName


    foreach ($stage in @(1, 5)) {

        Write-Host ""
        Write-Host "========================================"
        Write-Host "Phrase: $PhraseId"
        Write-Host "Key:    $keyName"
        Write-Host "Target: $transposeTarget"
        Write-Host "Stage:  $stage"
        Write-Host "========================================"


        # -------------------------------------------------
        # START FROM ORIGINAL PHRASE SOURCE
        # -------------------------------------------------

        $source =
            $templateText


        # -------------------------------------------------
        # REPLACE TARGET_KEY
        # -------------------------------------------------

        $source =
            $source.Replace(
                "TARGET_KEY",
                $transposeTarget
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