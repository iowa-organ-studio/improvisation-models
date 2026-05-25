export let FB_MODE = 'historic';

export function setFbMode(mode) {
    FB_MODE = (mode === 'modern') ? 'modern' : 'historic';
}

// ----------------------------
// FIGURE PARSING
// ----------------------------

function getFigureNumerals(figure) {
    const numerals = [];
    const matches = [...figure.matchAll(/\d+/g)];

    for (const m of matches) {
        numerals.push(Number(m[0]));
    }

    // standalone accidental = altered third
    if (/[#n-]/.test(figure) && !/\d[#n-]/.test(figure)) {
        numerals.push(3);
    }

    return numerals;
}

// ----------------------------
// DIATONIC LOGIC
// ----------------------------

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const LETTER_TO_SEMITONE = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
};

const KEY_SIGNATURES = {
    'C major': {},
    'G major': { F: '#' },
    'D major': { F: '#', C: '#' },
    'A major': { F: '#', C: '#', G: '#' },
    'E major': { F: '#', C: '#', G: '#', D: '#' },
    'B major': { F: '#', C: '#', G: '#', D: '#', A: '#' },
    'F# major': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' },
    'C# major': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#', B: '#' },

    'F major': { B: '-' },
    'Bb major': { B: '-', E: '-' },
    'Eb major': { B: '-', E: '-', A: '-' },
    'Ab major': { B: '-', E: '-', A: '-', D: '-' },
    'Db major': { B: '-', E: '-', A: '-', D: '-', G: '-' },
    'Gb major': { B: '-', E: '-', A: '-', D: '-', G: '-', C: '-' },
    'Cb major': { B: '-', E: '-', A: '-', D: '-', G: '-', C: '-', F: '-' },


    'a minor': {},
    'e minor': { F: '#' },
    'b minor': { F: '#', C: '#' },
    'f# minor': { F: '#', C: '#', G: '#' },
    'c# minor': { F: '#', C: '#', G: '#', D: '#' },
    'g# minor': { F: '#', C: '#', G: '#', D: '#', A: '#' },
    'd# minor': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' },
    'a# minor': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#', B: '#' },

    'd minor': { B: '-' },
    'g minor': { B: '-', E: '-' },
    'c minor': { B: '-', E: '-', A: '-' },
    'f minor': { B: '-', E: '-', A: '-', D: '-' },
    'bb minor': { B: '-', E: '-', A: '-', D: '-', G: '-' },
    'eb minor': { B: '-', E: '-', A: '-', D: '-', G: '-', C: '-' },
    'ab minor': { B: '-', E: '-', A: '-', D: '-', G: '-', C: '-', F: '-' }
};

function getScaleAccidental(tonic, mode, letter) {
    const key = `${tonic} ${mode}`;
    return (KEY_SIGNATURES[key] || {})[letter] || 'n';
}

// ----------------------------

export function computeDiatonicIntervalNotes(bass, figure, tonic, mode) {
    if (!bass) return '';

    const numerals = getFigureNumerals(figure);
    if (!numerals.length) return '';

    const bassLetter = bass[0].toUpperCase();
    const index = LETTERS.indexOf(bassLetter);

    const notes = [];

    for (const n of numerals) {
        const target = LETTERS[(index + n - 1) % 7];
        const acc = getScaleAccidental(tonic, mode, target);
        notes.push(target + acc);
    }

    return notes.join(' ');
}

// ----------------------------
// ACCIDENTAL HANDLING
// ----------------------------

function noteToSemitone(note) {
    const letter = note[0];
    const acc = note.slice(1);

    let s = LETTER_TO_SEMITONE[letter];

    if (acc === '#') s += 1;
    if (acc === '##') s += 2;
    if (acc === '-') s -= 1;
    if (acc === '--') s -= 2;

    return s;
}

function accidentalOffset(acc) {
    if (acc === '#') return 1;
    if (acc === '##') return 2;
    if (acc === '-') return -1;
    if (acc === '--') return -2;
    return 0;
}

function offsetToAccidental(o) {

    if (o === 1) return '#';
    if (o === 2) return '##';

    if (o === -1) return '-';
    if (o === -2) return '--';

    return '';
}

// ----------------------------

export function computeNewUpperNotesReferenced(din, dfd) {

    const notes =
        din.split(' ');

    const devs =
        dfd.split(' ').map(Number);

    return notes.map((note, i) => {

        const letter =
            note[0];

        const baseAcc =
            note.slice(1);

        const baseOffset =
            accidentalOffset(baseAcc);

        const finalOffset =
            baseOffset + devs[i];

        return (
            letter +
            offsetToAccidental(finalOffset)
        );

    }).join(' ');
}

// ----------------------------

export function computeDeviationFromDiatonic(din, unr) {

    if (!din || !unr) return '';

    const a = din.trim().split(/\s+/);
    const b = unr.trim().split(/\s+/);

    const len = Math.min(a.length, b.length);

    return a.slice(0, len).map((d, i) => {

        if (!d || !b[i]) {
            return '0';
        }

        const diff =
            noteToSemitone(b[i]) -
            noteToSemitone(d);

        return diff >= 0
            ? `+${diff}`
            : `${diff}`;

    }).join(' ');
}

// ----------------------------

export function computeNewUpperNotesReferenced(din, dfd) {
    const notes = din.split(' ');
    const devs = dfd.split(' ').map(Number);

    return notes.map((n, i) => {
        const offset = accidentalOffset(n.slice(1));
        const newOffset = offset + devs[i];
        return n[0] + offsetToAccidental(newOffset);
    }).join(' ');
}

// ----------------------------

export function buildNewFigure(original, newNotes) {

    // passthrough simple
    if (/^[\d\s]+$/.test(original)) return original;
    if (/[\/|\\]/.test(original)) return original;

    const accs = newNotes.split(' ').map(n => n.slice(1));
    let i = 0;

    return original.replace(/(\d+)?(--|-|n|#|##)/g, (_, num) => {
        const acc = accs[i++] || 'n';
        return num ? num + acc : acc;
    });
}

// ----------------------------
// KEY INTERVAL + TRANSPOSITION
// ----------------------------

const LETTER_INDEX = {
    C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6
};

const SEMITONES = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
};

function parseNote(note) {
    const m = note.match(/^([A-Ga-g])([#b-]?)$/);
    if (!m) return null;

    return {
        letter: m[1].toUpperCase(),
        accidental: m[2] === 'b' ? '-' : m[2] || ''
    };
}

function noteToValue(note) {
    const p = parseNote(note);
    if (!p) return 0;

    let val = SEMITONES[p.letter];

    if (p.accidental === '#') val += 1;
    if (p.accidental === '-') val -= 1;

    return val;
}

export function computeKeyIntervalDescription(from, to) {

    const a = parseNote(from);
    const b = parseNote(to);

    if (!a || !b) return null;

    const letterDistance =
        (LETTER_INDEX[b.letter] - LETTER_INDEX[a.letter] + 7) % 7;

    const semitoneDistance =
        (noteToValue(to) - noteToValue(from) + 12) % 12;

    return {
        letterShift: letterDistance,
        semitoneShift: semitoneDistance
    };
}

export function transposeBassNote(note, interval) {

    if (!note || !interval) return note;

    const parsed = parseNote(note);
    if (!parsed) return note;

    const newLetterIndex =
        (LETTER_INDEX[parsed.letter] + interval.letterShift) % 7;

    const newLetter =
        Object.keys(LETTER_INDEX).find(
            k => LETTER_INDEX[k] === newLetterIndex
        );

    const naturalValue = SEMITONES[newLetter];

    const targetValue =
        (noteToValue(note) + interval.semitoneShift) % 12;

    let accidentalOffset =
        targetValue - naturalValue;

    if (accidentalOffset > 6) accidentalOffset -= 12;
    if (accidentalOffset < -6) accidentalOffset += 12;

    let accidental = '';

    if (accidentalOffset > 0) {
        accidental = '#'.repeat(accidentalOffset);
    } else if (accidentalOffset < 0) {
        accidental = '-'.repeat(-accidentalOffset);
    }

    return newLetter + accidental;
}

// ----------------------------
// MAIN ENGINE
// ----------------------------

export function transformKrnFiguredBass({
    krnText,
    fromTonic,
    toTonic,
    mode,
    fbMode = FB_MODE
}) {

    const lines = krnText.split(/\r?\n/);
    let currentBass = null;

    const outLines = lines.map(line => {

        if (!line.includes('\t')) return line;


        // ✅ HEADER LINES
        if (line.startsWith('**')) {

            const fields = line.split('\t');

            if (fields.length >= 2) {
                fields[1] = '**fb';
            }

            if (fields.length >= 3) {
                fields.splice(2, 1);
            }

            return fields.join('\t');
        }


        // ✅ TERMINATOR LINES
        if (line.startsWith('*-')) {

            const fields = line.split('\t');

            if (fields.length >= 3) {
                fields.splice(2, 1);
            }

            return fields.join('\t');
        }

        const fields = line.split('\t');

        const bassField = (fields[0] || '').trim();
        const historic = (fields[1] || '').trim();
        const modern = (fields[2] || '').trim();

        const bassMatch = bassField.match(/([A-Ga-g]+[#-]*)/);
        if (bassMatch) currentBass = bassMatch[1];

        const hasFigure = historic && historic !== '.';

        if (!hasFigure) {
            // still remove modern spine
            fields.splice(2, 1);
            return fields.join('\t');
        }

        const activeFigure =
            (fbMode === 'modern' && modern && modern !== '.')
                ? modern
                : historic;

        // ✅ PASS-THROUGH RULES

        const isNumericOnly =
            /^[\d\s]+$/.test(activeFigure);

        const hasSlash =
            /[\/|\\]/.test(activeFigure);

        const isHistoricFlatFive =
            (fbMode === 'historic' && activeFigure === '5-');

        if (isNumericOnly || hasSlash || isHistoricFlatFive) {

            fields[1] = activeFigure;

            fields.splice(2, 1);

            return fields.join('\t');
        }

        const DIN = computeDiatonicIntervalNotes(
            currentBass,
            activeFigure,
            fromTonic,
            mode
        );

        const UNR = computeUpperNotesReferenced(
            currentBass,
            activeFigure,
            fromTonic,
            mode
        );

        const DFD = computeDeviationFromDiatonic(DIN, UNR);

        // ✅ TARGET KEY RECONSTRUCTION

        const interval = computeKeyIntervalDescription(
            fromTonic,
            toTonic
        );

        const newBass = transposeBassNote(
            currentBass,
            interval
        );


        const DINNK = computeDiatonicIntervalNotes(
            newBass,
            activeFigure,
            toTonic,
            mode
        );

        const NUNR = computeNewUpperNotesReferenced(
            DINNK,
            DFD
        );

        const newFigure = buildNewFigure(
            activeFigure,
            NUNR
        );

        console.log(activeFigure, newFigure);
        // replace figure
        fields[1] = newFigure;

        // remove modern spine
        fields.splice(2, 1);

        return fields.join('\t');
    });

    return {
        transformedKrn: outLines.join('\n')
    };
}
