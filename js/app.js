console.log('app.js module loaded');

import { createToolkit, renderKrn } from './render.js';
import { transformKrnFiguredBass, FB_MODE, setFbMode } from './fb-transform.js';
import { renderLilypondLevel2 } from './lilypond-renderer.js';

// ------------------- STATE -------------------



let currentModel = getModelFromURL();
let config = {};
let phrases = [];
let currentPhraseId = '';

let toolkit0, toolkit1, toolkit2;

let level0Text = '';
let level1Text = '';
let level2Text = '';

let currentTargetTonic = '';
let originalKeyTonic = '';
let originalKeyMode = '';

let venetianSourceFinal = '';
let venetianSourceLilypondKey = '';

let tenorClef = 'treble';
let altoClef = 'treble';

let fbAnalysisRows = [];
let allowMajor = true;
let allowMinor = true;

let enabledVenetianTones =
    new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

let phraseKeyCache = {};
let phraseToneCache = {};
let phraseAccidentalCountCache = {};
let phraseFinalCache = {};



// ------------------- INIT -------------------

function getModelFromURL() {
    const params = new URLSearchParams(window.location.search);

    const model = params.get('model');

    if (!model) {
        throw new Error("No model specified in URL.");
    }

    return model;
}

async function loadConfig() {
    const res = await fetch(`./tunes/${currentModel}/config.json`);
    config = await res.json();

    console.log("CONFIG:", config);

    document.getElementById('modelTitle').textContent = config.name;

    const musicImage = document.getElementById('heroMusicImage');
    const composerImage = document.getElementById('heroComposerImage');

    if (musicImage && config.heroMusicImage) {
        musicImage.src = config.heroMusicImage;
    }

    if (composerImage && config.heroComposerImage) {
        composerImage.src = config.heroComposerImage;
    }

    if (!config.levels.includes(0)) {
        document.getElementById('level0Wrap').style.display = 'none';
    } else {
        document.getElementById('level0Wrap').style.display = 'block';
    }

    const isLilypondLevel2 =
        config.level2Renderer === 'lilypond';

    const level2VerovioControls =
        document.getElementById('level2VerovioControls');

    const level2VerovioClefControls =
        document.getElementById('level2VerovioClefControls');

    if (level2VerovioControls) {
        level2VerovioControls.style.display =
            isLilypondLevel2 ? 'none' : '';
    }

    if (level2VerovioClefControls) {
        level2VerovioClefControls.style.display =
            isLilypondLevel2 ? 'none' : '';
    }
}


async function loadPhrases() {

    const res =
        await fetch(
            `./tunes/${currentModel}/phrases.json`
        );

    phrases = await res.json();

    phraseKeyCache = {};
    phraseToneCache = {};
    phraseAccidentalCountCache = {};

    for (const family of phrases) {

        const path =
            `./tunes/${currentModel}/${family}-01.krn`;

        try {

            const text =
                await loadText(path);

            phraseKeyCache[family] = text;

            if (currentModel === 'Venetian-Toccata') {

                phraseToneCache[family] =
                    parseVenetianToneFromKrn(text);

                phraseAccidentalCountCache[family] =
                    parseKeySignatureAccidentalCount(text);

                phraseFinalCache[family] =
                    parseVenetianFinalFromKrn(text);
            }

        } catch (err) {

            console.warn(
                'Failed loading phrase metadata:',
                family
            );
        }
    }
}

function randomPhrase() {

    if (currentModel === 'Venetian-Toccata') {

        const filtered =
            phrases.filter(family => {

                const tone =
                    phraseToneCache[family];

                return (
                    tone !== null &&
                    tone !== undefined &&
                    enabledVenetianTones.has(tone)
                );
            });

        if (!filtered.length) {
            return null;
        }

        return filtered[
            Math.floor(
                Math.random() * filtered.length
            )
        ];
    }

    const filtered =
        phrases.filter(family => {

            const krn =
                phraseKeyCache[family];

            if (!krn) {
                return true;
            }

            const parsed =
                parseKeyFromKrn(krn);

            if (
                parsed.mode === 'major' &&
                !allowMajor
            ) {
                return false;
            }

            if (
                parsed.mode === 'minor' &&
                !allowMinor
            ) {
                return false;
            }

            return true;
        });

    if (!filtered.length) {

        return phrases[
            Math.floor(
                Math.random() * phrases.length
            )
        ];
    }

    return filtered[
        Math.floor(
            Math.random() * filtered.length
        )
    ];
}

async function loadFamily(family) {

    currentPhraseId = family;

    const base =
        `./tunes/${currentModel}/${family}`;

    if (config.levels.includes(0)) {

        level0Text =
            await loadText(
                `${base}-00.krn`
            );
    }

    level1Text =
        await loadText(
            `${base}-01.krn`
        );

    level2Text =
        await loadText(
            `${base}-02.krn`
        );


    if (
        currentModel === 'Venetian-Toccata'
    ) {

        venetianSourceFinal =
            parseVenetianFinalFromKrn(
                level1Text
            );

        venetianSourceLilypondKey =
            parseVenetianSourceLilypondKey(
                level1Text
            );
    }


    const parsed =
        parseKeyFromKrn(level1Text);

    originalKeyTonic =
        parsed.tonic;

    originalKeyMode =
        parsed.mode;

    currentTargetTonic =
        originalKeyTonic;
}


function parseKeyFromKrn(krnText) {

    const match =
        krnText.match(/\*([A-Ga-g])([#-]?)\:/);

    if (!match) {
        return { tonic: 'C', mode: 'major' };
    }

    const letter = match[1];
    const accidental = match[2] || '';

    const tonic =
        letter.toUpperCase() +
        accidental.replace('-', 'b');

    const mode =
        letter === letter.toLowerCase()
            ? 'minor'
            : 'major';

    return { tonic, mode };
}

function parseVenetianFinalFromKrn(krnText) {

    const match =
        krnText.match(
            /^\*([A-Ga-g])([#-]?):/m
        );

    if (!match) {
        return null;
    }

    return (
        match[1].toUpperCase() +
        (match[2] || '').replace('-', 'b')
    );
}


function parseKernKeySignature(krnText) {

    const match =
        krnText.match(
            /^\*k\[([^\]]*)\]/m
        );

    if (!match) {
        return [];
    }

    const contents =
        match[1].trim();

    if (!contents) {
        return [];
    }

    return (
        contents.match(
            /[A-Ga-g][#-]?/g
        ) || []
    ).map(item =>
        item
            .replace('-', 'b')
            .replace(
                /^([a-g])$/,
                m => m.toUpperCase()
            )
    );
}

function pitchClass(tonic) {

    const normalized =
        tonic
            .replace('♭', 'b')
            .replace('♯', '#');

    const values = {
        'C': 0,
        'B#': 0,

        'C#': 1,
        'Db': 1,

        'D': 2,

        'D#': 3,
        'Eb': 3,

        'E': 4,
        'Fb': 4,

        'E#': 5,
        'F': 5,

        'F#': 6,
        'Gb': 6,

        'G': 7,

        'G#': 8,
        'Ab': 8,

        'A': 9,

        'A#': 10,
        'Bb': 10,

        'B': 11,
        'Cb': 11
    };

    return values[normalized];
}

function getVenetianTargetKeySignatureInfo(
    targetFinal
) {

    if (
        currentModel !== 'Venetian-Toccata' ||
        !venetianSourceFinal ||
        !venetianSourceLilypondKey
    ) {
        return null;
    }

    const sourceFinalPC =
        pitchClass(venetianSourceFinal);

    const targetFinalPC =
        pitchClass(targetFinal);

    const sourceLilypondPC =
        pitchClass(
            venetianSourceLilypondKey
        );

    if (
        sourceFinalPC === undefined ||
        targetFinalPC === undefined ||
        sourceLilypondPC === undefined
    ) {
        return null;
    }

    const interval =
        (
            targetFinalPC -
            sourceFinalPC +
            12
        ) % 12;

    const targetLilypondPC =
        (
            sourceLilypondPC +
            interval
        ) % 12;

    const keyInfo =
        getMajorKeySignatureInfo(
            targetLilypondPC
        );

    return {
        interval,
        targetLilypondPC,
        keyInfo
    };
}

function normalizeVenetianTargetTonic(
    targetFinal
) {

    if (
        currentModel !== 'Venetian-Toccata'
    ) {
        return targetFinal;
    }

    const candidates = [
        targetFinal
    ];

    const enharmonicMap = {
        'C#': 'Db',
        'Db': 'C#',

        'D#': 'Eb',
        'Eb': 'D#',

        'F#': 'Gb',
        'Gb': 'F#',

        'G#': 'Ab',
        'Ab': 'G#',

        'A#': 'Bb',
        'Bb': 'A#'
    };

    const alternative =
        enharmonicMap[targetFinal];

    if (alternative) {
        candidates.push(alternative);
    }

    for (const candidate of candidates) {

        const info =
            getVenetianTargetKeySignatureInfo(
                candidate
            );

        if (!info || !info.keyInfo) {
            continue;
        }

        if (
            info.keyInfo.sharps <= 7 &&
            info.keyInfo.flats <= 7
        ) {
            return candidate;
        }
    }

    return targetFinal;
}

function getMajorKeySignatureInfo(
    pitchClassValue
) {

    const keys = {

        0:  { name: 'C',  sharps: 0, flats: 0 },
        1:  { name: 'Db', sharps: 0, flats: 5 },
        2:  { name: 'D',  sharps: 2, flats: 0 },
        3:  { name: 'Eb', sharps: 0, flats: 3 },
        4:  { name: 'E',  sharps: 4, flats: 0 },
        5:  { name: 'F',  sharps: 0, flats: 1 },
        6:  { name: 'F#', sharps: 6, flats: 0 },
        7:  { name: 'G',  sharps: 1, flats: 0 },
        8:  { name: 'Ab', sharps: 0, flats: 4 },
        9:  { name: 'A',  sharps: 3, flats: 0 },
        10: { name: 'Bb', sharps: 0, flats: 2 },
        11: { name: 'B',  sharps: 5, flats: 0 }
    };

    return keys[pitchClassValue] || null;
}

function getVenetianLevel2Tonic() {

    if (
        currentModel !== 'Venetian-Toccata'
    ) {
        return currentTargetTonic;
    }

    if (
        !venetianSourceFinal ||
        !venetianSourceLilypondKey
    ) {
        return currentTargetTonic;
    }

    const sourceFinalPC =
        pitchClass(
            venetianSourceFinal
        );

    const targetFinalPC =
        pitchClass(
            currentTargetTonic
        );

    const sourceLilypondPC =
        pitchClass(
            venetianSourceLilypondKey
        );

    if (
        sourceFinalPC === undefined ||
        targetFinalPC === undefined ||
        sourceLilypondPC === undefined
    ) {
        return null;
    }

    const interval =
        (
            targetFinalPC -
            sourceFinalPC +
            12
        ) % 12;

    const targetLilypondPC =
        (
            sourceLilypondPC +
            interval
        ) % 12;

    const canonicalMajorKeys = {
        0: 'C',
        1: 'Db',
        2: 'D',
        3: 'Eb',
        4: 'E',
        5: 'F',
        6: 'F#',
        7: 'G',
        8: 'Ab',
        9: 'A',
        10: 'Bb',
        11: 'B'
    };

    return canonicalMajorKeys[
        targetLilypondPC
    ] || null;
}

function chooseMajorTonicSpelling(
    pitchClassValue,
    targetFinal
) {

    const preferredByFinal = {

        'C': 0,
        'B#': 0,

        'C#': 1,
        'Db': 1,

        'D': 2,

        'D#': 3,
        'Eb': 3,

        'E': 4,
        'Fb': 4,

        'E#': 5,
        'F': 5,

        'F#': 6,
        'Gb': 6,

        'G': 7,

        'G#': 8,
        'Ab': 8,

        'A': 9,

        'A#': 10,
        'Bb': 10,

        'B': 11,
        'Cb': 11
    };

    if (
        preferredByFinal[targetFinal] ===
        pitchClassValue
    ) {
        return targetFinal;
    }

    const canonicalMajorKeys = {
        0: 'C',
        1: 'Db',
        2: 'D',
        3: 'Eb',
        4: 'E',
        5: 'F',
        6: 'F#',
        7: 'G',
        8: 'Ab',
        9: 'A',
        10: 'Bb',
        11: 'B'
    };

    return canonicalMajorKeys[
        pitchClassValue
    ];
}

function parseVenetianSourceLilypondKey(krnText) {

    const signature =
        parseKernKeySignature(krnText);

    const normalized =
        signature
            .map(item => item.toLowerCase())
            .join(',');

    const signatureToMajorKey = {
        '': 'C',

        'f#': 'G',
        'f#,c#': 'D',
        'f#,c#,g#': 'A',
        'f#,c#,g#,d#': 'E',
        'f#,c#,g#,d#,a#': 'B',
        'f#,c#,g#,d#,a#,e#': 'F#',
        'f#,c#,g#,d#,a#,e#,b#': 'C#',

        'bb': 'F',
        'bb,eb': 'Bb',
        'bb,eb,ab': 'Eb',
        'bb,eb,ab,db': 'Ab',
        'bb,eb,ab,db,gb': 'Db',
        'bb,eb,ab,db,gb,cb': 'Gb',
        'bb,eb,ab,db,gb,cb,fb': 'Cb'
    };

    return (
        signatureToMajorKey[normalized] ||
        null
    );
}

function parseVenetianSourceMetadata(krnText) {

    const titleMatch =
        krnText.match(/^!!!\s*Title:\s*(.*)$/mi);

    const explicitModeMatch =
        krnText.match(/^!!!\s*Mode:\s*(.*)$/mi);

    const finalMatch =
        krnText.match(/^\*([A-Ga-g])([#-]?):/m);

    const keySignatureMatch =
        krnText.match(/^\*k\[([^\]]*)\]/m);

    let mode = null;

    if (explicitModeMatch) {

        mode =
            parseRomanMode(
                explicitModeMatch[1].trim()
            );

    } else if (titleMatch) {

        const titleModeMatch =
            titleMatch[1].match(/^([IVX]+)\./i);

        if (titleModeMatch) {

            mode =
                parseRomanMode(
                    titleModeMatch[1]
                );
        }
    }

    let final = null;

    if (finalMatch) {

        const letter =
            finalMatch[1].toUpperCase();

        const accidental =
            finalMatch[2] || '';

        final =
            letter +
            accidental.replace('-', 'b');
    }

    let accidentalCount = 0;

    if (keySignatureMatch) {

        const keySignature =
            keySignatureMatch[1];

        accidentalCount =
            (keySignature.match(/[A-Ga-g]/g) || []).length;
    }

    return {
        mode,
        final,
        accidentalCount
    };
}

function parseVenetianToneFromKrn(krnText) {

    const titleMatch =
        krnText.match(/^!!!\s*Title:\s*(.*)$/mi);

    if (!titleMatch) {
        return null;
    }

    const toneMatch =
        titleMatch[1].match(/\bTone\s+([IVX]+)\b/i);

    if (!toneMatch) {
        return null;
    }

    const roman =
        toneMatch[1].toUpperCase();

    const values = {
        I: 1,
        II: 2,
        III: 3,
        IV: 4,
        V: 5,
        VI: 6,
        VII: 7,
        VIII: 8,
        IX: 9,
        X: 10
    };

    return values[roman] || null;
}



function parseKeySignatureAccidentalCount(krnText) {

    const match =
        krnText.match(/^\*k\[([^\]]*)\]/m);

    if (!match) {
        return 0;
    }

    const keySignature =
        match[1].trim();

    if (!keySignature) {
        return 0;
    }

    return (
        keySignature.match(
            /[A-Ga-g](?:[#-])?/g
        ) || []
    ).length;
}

function parseRomanMode(value) {

    const roman =
        value
            .trim()
            .toUpperCase();

    const values = {
        I: 1,
        II: 2,
        III: 3,
        IV: 4,
        V: 5,
        VI: 6,
        VII: 7,
        VIII: 8,
        IX: 9,
        X: 10
    };

    return values[roman] || null;
}

function parsePhraseInfo(krnText) {

    const titleMatch =
        krnText.match(/^!!!\s*Title:\s*(.*)$/mi);

    const numberMatch =
        krnText.match(/^!!!\s*Number:\s*(.*)$/mi);

    const title =
        titleMatch
            ? titleMatch[1].trim()
            : 'Unknown';

    const number =
        numberMatch
            ? numberMatch[1].trim()
            : '?';

    let toccataNumber = null;
    let tone = null;

    if (currentModel === 'Venetian-Toccata') {

        const titleParts =
            title.match(
                /^([IVX]+)\.\s*Tone\s+([IVX]+)$/i
            );

        if (titleParts) {

            toccataNumber =
                titleParts[1].toUpperCase();

            tone =
                titleParts[2].toUpperCase();
        }
    }

    return {
        title,
        number,
        toccataNumber,
        tone
    };
}

async function loadText(path) {
    const r = await fetch(path);
    return await r.text();
}

const STEPPER_MAJOR = [
    'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'
];

const STEPPER_MINOR = [
    'a', 'bb', 'b', 'c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'g#'
];

const STEPPER_VENETIAN = [
    'C',
    'Db',
    'D',
    'Eb',
    'E',
    'F',
    'F#',
    'G',
    'Ab',
    'A',
    'Bb',
    'B'
];

function stepCurrentTonic(direction) {

    const list =
        currentModel === 'Venetian-Toccata'
            ? STEPPER_VENETIAN
            : (
                originalKeyMode === 'minor'
                    ? STEPPER_MINOR
                    : STEPPER_MAJOR
            );

    let index =
        list.indexOf(currentTargetTonic);

    if (index < 0) {
        index = 0;
    }

    index += direction;

    if (index < 0) {
        index = list.length - 1;
    }

    if (index >= list.length) {
        index = 0;
    }

    const candidate =
        list[index];

    currentTargetTonic =
        normalizeVenetianTargetTonic(
            candidate
        );
}

function computeVerovioTranspose() {

    const tonic = currentTargetTonic;

    const match =
        tonic.match(/^([A-Ga-g])([#b]?)$/);

    if (!match) return '';

    const pname = match[1].toLowerCase();

    const accidental = match[2] || '';

    const accid =
        accidental === '#'
            ? 's'
            : accidental === 'b'
                ? 'f'
                : '';

    return pname + accid;
}

function updateKeyPill() {

    if (currentModel === 'Venetian-Toccata') {

        const info =
            parsePhraseInfo(level1Text);

        const final =
            currentTargetTonic
                .replace(/b/g, '♭')
                .replace(/#/g, '♯');

        if (info.tone) {

            document.getElementById(
                'keyDisplay'
            ).textContent =
                `Tone ${info.tone} (${final} Final)`;

            return;
        }
    }

    const prettyKey =
        currentTargetTonic
            .replace(/b/g, '♭')
            .replace(/#/g, '♯');

    document.getElementById(
        'keyDisplay'
    ).textContent =
        `Current key: ${prettyKey} ${originalKeyMode}`;
}

function updatePhrasePill() {

    const info =
        parsePhraseInfo(level1Text);

    if (
        currentModel === 'Venetian-Toccata' &&
        info.toccataNumber &&
        info.tone
    ) {

        document.getElementById(
            'phraseDisplay'
        ).textContent =
            `Toccata ${info.toccataNumber} Tone ${info.tone} (Phrase ${info.number})`;

        return;
    }

    document.getElementById(
        'phraseDisplay'
    ).textContent =
        `${info.title} Phrase ${info.number}`;
}
const ENHARMONIC_MAJOR = {
    'Db': 'C#', 'C#': 'Db',
    'F#': 'Gb', 'Gb': 'F#',
    'B': 'Cb', 'Cb': 'B',
};

const ENHARMONIC_MINOR = {
    'eb': 'd#', 'd#': 'eb',
    'g#': 'ab', 'ab': 'g#',
    'bb': 'a#', 'a#': 'bb'
};

function toggleEnharmonic() {

    let map;

    if (currentModel === 'Venetian-Toccata') {

        map = {
            'Db': 'C#',
            'C#': 'Db',

            'Ab': 'G#',
            'G#': 'Ab'
        };

    } else {

        map =
            originalKeyMode === 'minor'
                ? ENHARMONIC_MINOR
                : ENHARMONIC_MAJOR;
    }

    const replacement =
        map[currentTargetTonic];

    if (!replacement) {
        return;
    }

    currentTargetTonic =
        replacement;

    updateKeyPill();
    renderAll();
}

// ------------------- SCALE/SPACING HELPERS -------------------

function getNumber(id) {
    return parseFloat(document.getElementById(id).value);
}

function setNumber(id, val) {
    document.getElementById(id).value = val;
}

function wireScaleSpacing(prefix) {

    const scaleInput = document.getElementById(`${prefix}ScaleValue`);
    const spacingInput = document.getElementById(`${prefix}SpacingValue`);

    document.getElementById(`${prefix}ScalePlus`)
        .addEventListener('click', () => {
            setNumber(scaleInput.id, getNumber(scaleInput.id) + 2);
            renderAll();
        });

    document.getElementById(`${prefix}ScaleMinus`)
        .addEventListener('click', () => {
            setNumber(scaleInput.id, Math.max(10, getNumber(scaleInput.id) - 2));
            renderAll();
        });

    document.getElementById(`${prefix}SpacingPlus`)
        .addEventListener('click', () => {
            setNumber(spacingInput.id, getNumber(spacingInput.id) + 0.1);
            renderAll();
        });

    document.getElementById(`${prefix}SpacingMinus`)
        .addEventListener('click', () => {
            setNumber(spacingInput.id, Math.max(0.1, getNumber(spacingInput.id) - 0.1));
            renderAll();
        });

    // Allow manual typing
    scaleInput.addEventListener('change', renderAll);
    spacingInput.addEventListener('change', renderAll);
}


// ------------------- RENDER -------------------
function renderAll() {

    // LEVEL 0
    if (config.levels.includes(0)) {

        document.getElementById('level0Wrap').style.display = 'block';

        renderKrn(
            toolkit0,
            level0Text,
            document.getElementById('level0'),
            {
                scale: getNumber('l0ScaleValue'),
                spacing: getNumber('l0SpacingValue')
            },
            computeVerovioTranspose()
        );

    } else {
        document.getElementById('level0Wrap').style.display = 'none';
    }


    // LEVEL 1
    const { transformedKrn } =
        transformKrnFiguredBass({
            krnText: level1Text,
            fromTonic: originalKeyTonic,
            toTonic: currentTargetTonic,
            mode: originalKeyMode,
            fbMode: FB_MODE
        });

    renderKrn(
        toolkit1,
        transformedKrn,
        document.getElementById('level1'),
        {
            scale: getNumber('l1ScaleValue'),
            spacing: getNumber('l1SpacingValue')
        },
        computeVerovioTranspose()
    );


    // LEVEL 2
    const level2Container =
        document.getElementById('level2');

    if (config.level2Renderer === 'lilypond') {

        const lilypondLevel2Tonic =
            getVenetianLevel2Tonic();

        renderLilypondLevel2({
            container: level2Container,
            currentModel,
            phraseId: currentPhraseId,
            tonic: lilypondLevel2Tonic
        });

    } else {

        const level2Display =
            buildLevel2ClefOverrideKrn();

        renderKrn(
            toolkit2,
            level2Display,
            level2Container,
            {
                scale: getNumber('l2ScaleValue'),
                spacing: getNumber('l2SpacingValue')
            },
            computeVerovioTranspose()
        );
    }
}

async function newPhrase() {

    const family = randomPhrase();

    await loadFamily(family);
    chooseRandomTargetKey();
    updateKeyPill();
    updatePhrasePill();

    // reset UI defaults

    if (config.levels.includes(0)) {
        document.getElementById('level0Details').open = true;
        document.getElementById('level1Details').open = false;
    } else {
        document.getElementById('level1Details').open = true;
    }

    document.getElementById('level2Details').open = false;

    renderAll();
}

function updateKeyDisplay() {
    document.getElementById('keyDisplay').textContent = currentKey;
}

function wireClefOverrideRadios() {

    function refreshClefUI() {

        document
            .getElementById('altoTrebleLabel')
            .classList.toggle(
                'selected',
                altoClef === 'treble'
            );

        document
            .getElementById('altoBassLabel')
            .classList.toggle(
                'selected',
                altoClef === 'bass'
            );

        document
            .getElementById('tenorTrebleLabel')
            .classList.toggle(
                'selected',
                tenorClef === 'treble'
            );

        document
            .getElementById('tenorBassLabel')
            .classList.toggle(
                'selected',
                tenorClef === 'bass'
            );
    }

    document
        .getElementById('tenorTrebleRadio')
        .addEventListener('change', () => {

            tenorClef = 'treble';

            refreshClefUI();

            renderAll();
        });

    document
        .getElementById('tenorBassRadio')
        .addEventListener('change', () => {

            tenorClef = 'bass';

            refreshClefUI();

            renderAll();
        });

    document
        .getElementById('altoTrebleRadio')
        .addEventListener('change', () => {

            altoClef = 'treble';

            refreshClefUI();

            renderAll();
        });

    document
        .getElementById('altoBassRadio')
        .addEventListener('change', () => {

            altoClef = 'bass';

            refreshClefUI();

            renderAll();
        });

    refreshClefUI();
}



function syncClefRadios() {

    document.getElementById('tenorTrebleRadio').checked =
        tenorClef === 'treble';

    document.getElementById('tenorBassRadio').checked =
        tenorClef === 'bass';

    document.getElementById('altoTrebleRadio').checked =
        altoClef === 'treble';

    document.getElementById('altoBassRadio').checked =
        altoClef === 'bass';
}

function wireFbModeButtons() {

    const historic =
        document.getElementById('historicLabel');

    const modern =
        document.getElementById('modernLabel');

    document
        .querySelectorAll('input[name="fbMode"]')
        .forEach(radio => {

            radio.addEventListener('change', () => {

                setFbMode(radio.value);

                if (radio.value === 'historic') {

                    historic.classList.add('selected');
                    modern.classList.remove('selected');

                } else {

                    modern.classList.add('selected');
                    historic.classList.remove('selected');
                }

                renderAll();
            });
        });
}


function buildLevel2ClefOverrideKrn() {

    const lines = level2Text.split(/\r?\n/);

    return lines.map(line => {

        if (!line.includes('clef')) {
            return line;
        }

        const fields = line.split('\t');

        // spine 2 = tenor
        if (fields[1]) {

            if (tenorClef === 'bass') {

                fields[1] =
                    fields[1].replace('clefG2', 'clefF4');

            } else {

                fields[1] =
                    fields[1].replace('clefF4', 'clefG2');
            }
        }

        // spine 3 = alto
        if (fields[2]) {

            if (altoClef === 'bass') {

                fields[2] =
                    fields[2].replace('clefG2', 'clefF4');

            } else {

                fields[2] =
                    fields[2].replace('clefF4', 'clefG2');
            }
        }

        return fields.join('\t');

    }).join('\n');
}

function refreshKeyButtonsUI() {

    document.querySelectorAll('.key-btn')
        .forEach(btn => {

            const count = Number(btn.dataset.count);

            if (enabledCounts.has(count)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
}

function wireKeyButtons() {

    document.querySelectorAll('.key-btn')
        .forEach(btn => {

            btn.addEventListener('click', () => {

                const count = Number(btn.dataset.count);

                if (enabledCounts.has(count)) {
                    enabledCounts.delete(count);
                } else {
                    enabledCounts.add(count);
                }

                refreshKeyButtonsUI();
            });
        });

    document.getElementById('selectAllKeysBtn')
        .addEventListener('click', () => {

            enabledCounts.clear();

            for (let i = 0; i <= 7; i++) {
                enabledCounts.add(i);
            }

            refreshKeyButtonsUI();
        });

    document.getElementById('selectNoneKeysBtn')
        .addEventListener('click', () => {

            enabledCounts.clear();

            refreshKeyButtonsUI();
        });
}

function wireModeButtons() {

    const card =
        document.getElementById('modeFilterCard');

    if (!card) {
        return;
    }

    if (currentModel === 'Venetian-Toccata') {

        card.innerHTML = '';

        const romanNumerals = [
            'I',
            'II',
            'III',
            'IV',
            'V',
            'VI',
            'VII',
            'VIII',
            'IX',
            'X'
        ];

        for (let tone = 1; tone <= 10; tone++) {

            const button =
                document.createElement('button');

            button.className =
                'mode-filter-btn';

            button.dataset.tone =
                String(tone);

            button.textContent =
                `Tone ${romanNumerals[tone - 1]}`;

            button.classList.toggle(
                'selected',
                enabledVenetianTones.has(tone)
            );

            button.addEventListener(
                'click',
                () => {

                    if (
                        enabledVenetianTones.has(tone)
                    ) {

                        enabledVenetianTones.delete(tone);

                    } else {

                        enabledVenetianTones.add(tone);
                    }

                    button.classList.toggle(
                        'selected',
                        enabledVenetianTones.has(tone)
                    );
                }
            );

            card.appendChild(button);
        }

        return;
    }

    const majorBtn =
        document.getElementById('majorModeBtn');

    const minorBtn =
        document.getElementById('minorModeBtn');

    majorBtn.addEventListener(
        'click',
        () => {

            allowMajor = !allowMajor;

            majorBtn.classList.toggle(
                'selected',
                allowMajor
            );
        }
    );

    minorBtn.addEventListener(
        'click',
        () => {

            allowMinor = !allowMinor;

            minorBtn.classList.toggle(
                'selected',
                allowMinor
            );
        }
    );
}

window.openHelp = openHelp;
window.closeHelp = closeHelp;


async function openHelp() {
    console.log('openHelp called');
    const res = await fetch(`./tunes/${currentModel}/help.html`);
    console.log('fetch status:', res.status);
    const html = await res.text();
    console.log('html length:', html.length);
    document.getElementById('helpContent').innerHTML = html;
    document.getElementById('helpOverlay').classList.add('open');
    document.getElementById('helpPanel').classList.add('open');
}
function closeHelp() {
    document.getElementById('helpOverlay').classList.remove('open');
    document.getElementById('helpPanel').classList.remove('open');
}



function chooseRandomTargetKey() {

    if (
        currentModel === 'Venetian-Toccata'
    ) {

        const candidates = [];

        for (
            const candidate of STEPPER_VENETIAN
        ) {

            const info =
                getVenetianTargetKeySignatureInfo(
                    candidate
                );

            if (
                !info ||
                !info.keyInfo
            ) {
                continue;
            }

            const accidentalCount =
                Math.max(
                    info.keyInfo.sharps,
                    info.keyInfo.flats
                );

            if (
                enabledCounts.has(
                    accidentalCount
                )
            ) {
                candidates.push(candidate);
            }
        }

        if (!candidates.length) {

            currentTargetTonic = '';

            return;
        }

        const candidate =
            candidates[
                Math.floor(
                    Math.random() *
                    candidates.length
                )
            ];

        currentTargetTonic =
            normalizeVenetianTargetTonic(
                candidate
            );

        return;
    }

    const pool = [];

    let source = {};

    if (originalKeyMode === 'minor') {

        if (!allowMinor) {
            return;
        }

        source = MINOR_BY_COUNT;

    } else {

        if (!allowMajor) {
            return;
        }

        source = MAJOR_BY_COUNT;
    }

    for (const count of enabledCounts) {

        const arr =
            source[count] || [];

        pool.push(...arr);
    }

    if (!pool.length) {
        return;
    }

    currentTargetTonic =
        pool[
            Math.floor(
                Math.random() * pool.length
            )
        ];

    currentTargetTonic =
        currentTargetTonic.replace(
            /^([a-g])/,
            m => m.toUpperCase()
        );
}


const MAJOR_BY_COUNT = {
    0: ['C'],
    1: ['G', 'F'],
    2: ['D', 'Bb'],
    3: ['A', 'Eb'],
    4: ['E', 'Ab'],
    5: ['B', 'Db'],
    6: ['F#', 'Gb'],
    7: ['C#', 'Cb']
};

const MINOR_BY_COUNT = {
    0: ['a'],
    1: ['e', 'd'],
    2: ['b', 'g'],
    3: ['f#', 'c'],
    4: ['c#', 'f'],
    5: ['g#', 'bb'],
    6: ['d#', 'eb'],
    7: ['a#', 'ab']
};

let enabledCounts = new Set([0, 1, 2, 3, 4, 5, 6, 7]);



// ------------------- MAIN -------------------

async function main() {

    toolkit0 = await createToolkit();
    toolkit1 = await createToolkit();
    toolkit2 = await createToolkit();

    await loadConfig();
    await loadPhrases();

    await newPhrase();
    wireClefOverrideRadios();
    syncClefRadios();
    wireKeyButtons();
    wireModeButtons();
    refreshKeyButtonsUI();
    wireFbModeButtons();
    wireScaleSpacing('l0');
    wireScaleSpacing('l1');
    wireScaleSpacing('l2');



    const notch = document.getElementById('helpNotch');
    console.log('helpNotch element:', notch);
    notch?.addEventListener('click', openHelp);

    document.getElementById('randomBtn')
        .addEventListener('click', newPhrase);

    document.getElementById('upKey').addEventListener('click', () => {

        stepCurrentTonic(+1);

        updateKeyPill();

        renderAll();
    });

    document.getElementById('downKey').addEventListener('click', () => {

        stepCurrentTonic(-1);

        updateKeyPill();

        renderAll();
    });

    document.getElementById('enharmonicBtn').addEventListener('click', () => {

        toggleEnharmonic();
    });
}

main();
