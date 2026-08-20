# =========================================================
# Venetian Toccata LilyPond SVG Generator - ALL SOURCES
#
# Generates stage 1 and stage 5 SVGs for EVERY .ly file
# in ../sources
#
# Usage:
#
#   .\generate-all.ps1
#
# =========================================================

$ErrorActionPreference = "Stop"


# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

$TemplateDirectory =
    $PSScriptRoot

$SourcesDirectory =
    Join-Path `
        $TemplateDirectory `
        "..\sources"

$TempRoot =
    Join-Path `
        $env:TEMP `
        "lilypond-intavolatura-all"


# ---------------------------------------------------------
# MAJOR KEYS
#
# These are the key folders used by the site.
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
    # Shortest chromatic interval
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
    # Tritone direction is determined by spelling.
    #
    # C -> F# = augmented 4th = UP
    # C -> Gb = diminished 5th = DOWN
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
    # Add LilyPond octave marks when needed.
    #
    # Example:
    #
    #   c -> b
    #
    # becomes:
    #
    #   b,
    #
    # because C -> B is down a half step.
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
# FIND ALL SOURCE FILES
# ---------------------------------------------------------

if (!(Test-Path $SourcesDirectory)) {

    throw `
        "Sources directory not found: $SourcesDirectory"
}


$SourceFiles =
    Get-ChildItem `
        -Path $SourcesDirectory `
        -Filter "*.ly" `
        -File |
    Sort-Object Name


if ($SourceFiles.Count -eq 0) {

    throw `
        "No .ly files found in: $SourcesDirectory"
}


Write-Host ""
Write-Host "Found $($SourceFiles.Count) source files."
Write-Host ""


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
# PROCESS EVERY SOURCE FILE
# ---------------------------------------------------------

foreach ($sourceFile in $SourceFiles) {

    $PhraseId =
        [System.IO.Path]::GetFileNameWithoutExtension(
            $sourceFile.Name
        )


    Write-Host ""
    Write-Host "########################################"
    Write-Host "PROCESSING: $PhraseId"
    Write-Host "########################################"
    Write-Host ""


    # -----------------------------------------------------
    # OUTPUT ROOT FOR THIS PHRASE
    # -----------------------------------------------------

    $OutputRoot =
        Join-Path `
            $TemplateDirectory `
            "..\$PhraseId"


    # -----------------------------------------------------
    # READ SOURCE
    # -----------------------------------------------------

    $templateText =
        Get-Content `
            -Path $sourceFile.FullName `
            -Raw


    # -----------------------------------------------------
    # FIND TRANSPOSE TEMPLATE
    #
    # We expect:
    #
    #   \transpose c TARGET_KEY
    #
    # or:
    #
    #   \transpose f TARGET_KEY
    # -----------------------------------------------------

    $transposeMatch =
        [regex]::Match(
            $templateText,
            '\\transpose\s+([a-g](?:is|es)?)\s+TARGET_KEY'
        )


    if (!$transposeMatch.Success) {

        Write-Warning `
            "Skipping ${PhraseId}: could not find '\transpose SOURCE TARGET_KEY'."

        continue
    }


    $sourcePitch =
        $transposeMatch.Groups[1].Value


    Write-Host `
        "Source transpose pitch: $sourcePitch"


    # -----------------------------------------------------
    # GENERATE ALL KEYS
    # -----------------------------------------------------

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


        # -------------------------------------------------
        # CALCULATE ACTUAL LILYPOND TARGET
        # -------------------------------------------------

        $transposeTarget =
            GetTransposeTarget `
                -SourcePitch $sourcePitch `
                -TargetPitch $keyName


        Write-Host ""
        Write-Host "  Key:    $keyName"
        Write-Host "  Target: $transposeTarget"


        # -------------------------------------------------
        # GENERATE STAGES 1 AND 5
        # -------------------------------------------------

        foreach ($stage in @(1, 5)) {

            Write-Host `
                "  Stage $stage"


            # ---------------------------------------------
            # START FROM ORIGINAL SOURCE
            # ---------------------------------------------

            $source =
                $templateText


            # ---------------------------------------------
            # REPLACE TARGET_KEY
            # ---------------------------------------------

            $source =
                $source.Replace(
                    "TARGET_KEY",
                    $transposeTarget
                )


            # ---------------------------------------------
            # REPLACE STAGE
            # ---------------------------------------------

            $source =
                [regex]::Replace(
                    $source,
                    '(?m)^\s*#\(define stage [1-5]\).*$',
                    "#(define stage $stage)"
                )


            # ---------------------------------------------
            # TEMPORARY LILYPOND SOURCE
            # ---------------------------------------------

            $tempLy =
                Join-Path `
                    $TempRoot `
                    "$PhraseId-$keyName-stage$stage.ly"

            Set-Content `
                -Path $tempLy `
                -Value $source `
                -Encoding UTF8


            # ---------------------------------------------
            # OUTPUT BASENAME
            # ---------------------------------------------

            $outputBase =
                Join-Path `
                    $TempRoot `
                    "$PhraseId-$keyName-stage$stage"


            # ---------------------------------------------
            # RUN LILYPOND
            # ---------------------------------------------

            & lilypond `
                --svg `
                -o $outputBase `
                $tempLy

            if ($LASTEXITCODE -ne 0) {

                throw `
                    "LilyPond failed for $PhraseId / $keyName / stage $stage"
            }


            # ---------------------------------------------
            # CHECK SVG
            # ---------------------------------------------

            $croppedSvg =
                "$outputBase.svg"

            if (!(Test-Path $croppedSvg)) {

                throw `
                    "SVG not found: $croppedSvg"
            }


            # ---------------------------------------------
            # COPY FINAL SVG
            # ---------------------------------------------

            $finalSvg =
                Join-Path `
                    $outputDir `
                    "stage$stage.svg"

            Copy-Item `
                -Path $croppedSvg `
                -Destination $finalSvg `
                -Force
        }
    }


    Write-Host ""
    Write-Host "Completed: $PhraseId"
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
Write-Host "ALL SOURCES COMPLETE"
Write-Host "========================================"
Write-Host ""
Write-Host "Processed:"
Write-Host "  $($SourceFiles.Count) source files"
Write-Host ""