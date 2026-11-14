# =========================================================
# Venetian Toccata LilyPond SVG Generator
#
# Usage:
#
#   .\generate.ps1 Merulo-Book2Tocc1Tone5-01
#
# Input:
#
#   ../sources/Merulo-Book2Tocc1Tone5-01.ly
#
# Output:
#
#   ../Merulo-Book2Tocc1Tone5-01/
#       c/wide/stage1.svg, stage5.svg
#       c/medium/stage1.svg, stage5.svg
#       c/narrow/stage1.svg, stage5.svg
#       ... all 15 keys, including cis and des
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
    Write-Host "  .\generate.ps1 Merulo-Book2Tocc1Tone5-01"
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
        '\\transpose\s+([a-g](?:is|es)?)\s+([a-g](?:is|es)?)\b'
    )


if (!$transposeMatch.Success) {

    throw `
        "Could not find '\transpose SOURCE TARGET_KEY' in ${Template}"
}


$sourcePitch =
    $transposeMatch.Groups[1].Value

if ([regex]::Matches($templateText, '\\transpose\s+[a-g](?:is|es)?\s+[a-g](?:is|es)?\b').Count -lt 1) {
    throw 'No transposition directives found'
}


Write-Host ""
Write-Host "Source transpose pitch: $sourcePitch"
Write-Host ""


# ---------------------------------------------------------
# RESPONSIVE VENETIAN LAYOUTS (all phrases; test one first)
# ---------------------------------------------------------

$Layouts = @(
    @{ Name = "wide"; Width = 300 },
    @{ Name = "medium"; Width = 220 },
    @{ Name = "narrow"; Width = 155 }
)

function Set-ResponsiveEngraving {
    param([string]$Text, [int]$Width)

    # Replace the existing paper block; do not stack paper settings.
    # This matches the paper block up to the next SCORE heading in
    # the current Venetian source format.
    $paperPattern = '(?s)\\paper\s*\{.*?(?=\r?\n% =+\r?\n% SCORE)'
    $paperReplacement = @"
\paper {
  indent = 0
  paper-width = ${Width}\mm
  left-margin = 8\mm
  right-margin = 8\mm
  top-margin = 8\mm
  bottom-margin = 8\mm
  page-breaking = #ly:one-page-breaking
  ragged-right = ##f
  ragged-bottom = ##t
  tagline = ##f
  system-system-spacing =
    #'((basic-distance . 18)
       (minimum-distance . 16)
       (padding . 3))
}

"@
    $matches = [regex]::Matches($Text, $paperPattern)
    if ($matches.Count -ne 1) {
        throw "Expected exactly one Venetian paper block; found $($matches.Count)"
    }
    $Text = [regex]::Replace($Text, $paperPattern, [System.Text.RegularExpressions.MatchEvaluator]{param($m) $paperReplacement})

    # Remove active explicit breaks only; preserve commented-out examples.
    # Work one line at a time to avoid accidentally changing comments.
    $Text = [regex]::Replace($Text, '(?m)^(?!\s*%)([^%\r\n]*?)\\(?:noBreak|break)\b', '$1')

    # Insert the tested spacing overrides into the existing Score context.
    # The source has one layout block and one PianoStaff context.
    $layoutPattern = '\\layout\s*\{\s*\\context\s*\{\s*\\PianoStaff'
    if ([regex]::Matches($Text, $layoutPattern).Count -ne 1) {
        throw 'Expected one layout/PianoStaff block in Venetian source'
    }
    $layoutReplacement = @'
\layout {
  \context {
    \Score
    \override SpacingSpanner.common-shortest-duration =
      #(ly:make-moment 1/16)
    \override SpacingSpanner.shortest-duration-space = #1.5
  }
  \context {
    \PianoStaff
'@
    $Text = [regex]::Replace($Text, $layoutPattern, [System.Text.RegularExpressions.MatchEvaluator]{param($m) $layoutReplacement})
    return $Text
}

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


    foreach ($layout in $Layouts) {

    foreach ($stage in @(1, 5)) {

        Write-Host ""
        Write-Host "========================================"
        Write-Host "Phrase: $PhraseId"
        Write-Host "Key:    $keyName"
        Write-Host "Target: $transposeTarget"
        Write-Host "Stage:  $stage"
        Write-Host "Layout: $($layout.Name) ($($layout.Width) mm)"
        Write-Host "========================================"


        # -------------------------------------------------
        # START FROM ORIGINAL PHRASE SOURCE
        # -------------------------------------------------

        $source =
            $templateText


        # -------------------------------------------------
        # REPLACE DESTINATION PITCH
        # -------------------------------------------------

        $source =
                [regex]::Replace(
                    $source,
                    '\\transpose\s+([a-g](?:is|es)?)\s+([a-g](?:is|es)?)\b',
                    [System.Text.RegularExpressions.MatchEvaluator]{
                        param($m)
                        "\transpose $($m.Groups[1].Value) $transposeTarget"
                    }
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
        $source = Set-ResponsiveEngraving -Text $source -Width $layout.Width

        # TEMPORARY LILYPOND SOURCE
        # -------------------------------------------------

        $tempLy =
            Join-Path `
                $TempRoot `
                "$keyName-$($layout.Name)-stage$stage.ly"

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
                "$keyName-$($layout.Name)-stage$stage"


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

        $layoutDir = Join-Path $outputDir $layout.Name
        if (!(Test-Path $layoutDir)) {
            New-Item -ItemType Directory -Path $layoutDir | Out-Null
        }
        $finalSvg = Join-Path $layoutDir "stage$stage.svg"

        Copy-Item `
            -Path $croppedSvg `
            -Destination $finalSvg `
            -Force


        Write-Host ""
        Write-Host "Created:"
        Write-Host "  $finalSvg"
    }
    } # layout

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