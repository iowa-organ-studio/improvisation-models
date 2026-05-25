import { createToolkit, renderKrn } from './render.js';
import { transformKrnFiguredBass, FB_MODE, setFbMode } from './fb-transform.js';

// ------------------- STATE -------------------



let currentModel = getModelFromURL();
let config = {};
let phrases = [];

let toolkit0, toolkit1, toolkit2;

let level0Text = '';
let level1Text = '';
let level2Text = '';

let currentTargetTonic = '';
let originalKeyTonic = '';
let originalKeyMode = '';

let tenorClef = 'treble';
let altoClef = 'treble';

let fbAnalysisRows = [];




// ------------------- INIT -------------------

function getModelFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('model') || 'Buxtehude-Chorale-Prelude';
}

async function loadConfig() {
    const module = await import(`../tunes/${currentModel}/config.js`);
    config = module.default;



    console.log("CONFIG:", config);   // ✅ ADD THIS LINE RIGHT HERE

    document.getElementById('modelTitle').textContent = config.name;

    const musicImage =
        document.getElementById('heroMusicImage');

    const composerImage =
        document.getElementById('heroComposerImage');

    if (musicImage && config.heroMusicImage) {

        musicImage.src =
            config.heroMusicImage;
    }

    if (composerImage && config.heroComposerImage) {

        composerImage.src =
            config.heroComposerImage;
    }

    if (!config.levels.includes(0)) {
        const wrap = document.getElementById('level0Wrap');
        wrap.style.display = 'none';
    }


    else {
        document.getElementById('level0Wrap').style.display = 'block';
    }
}

async function loadPhrases() {
    const res = await fetch(`./tunes/${currentModel}/phrases.json`);
    phrases = await res.json();
}

function randomPhrase() {
    return phrases[Math.floor(Math.random() * phrases.length)];
}

async function loadFamily(family) {
    const base = `./tunes/${currentModel}/${family}`;

    if (config.levels.includes(0)) {
        level0Text = await loadText(`${base}-00.krn`);
    }

    level1Text = await loadText(`${base}-01.krn`);
    level2Text = await loadText(`${base}-02.krn`);

    const parsed = parseKeyFromKrn(level1Text);

    originalKeyTonic = parsed.tonic;
    originalKeyMode = parsed.mode;

    currentTargetTonic = originalKeyTonic;
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

function stepCurrentTonic(direction) {

    const list =
        originalKeyMode === 'minor'
            ? STEPPER_MINOR
            : STEPPER_MAJOR;

    let index = list.indexOf(currentTargetTonic);

    if (index < 0) index = 0;

    index += direction;

    if (index < 0) index = list.length - 1;
    if (index >= list.length) index = 0;

    currentTargetTonic = list[index];
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
    document.getElementById('keyDisplay').textContent =
        `Current key: ${currentTargetTonic} ${originalKeyMode}`;
}

const ENHARMONIC_MAJOR = {
    'Db': 'C#', 'C#': 'Db',
    'F#': 'Gb', 'Gb': 'F#'
};

const ENHARMONIC_MINOR = {
    'eb': 'd#', 'd#': 'eb',
    'g#': 'ab', 'ab': 'g#',
    'bb': 'a#', 'a#': 'bb'
};

function toggleEnharmonic() {

    const map =
        originalKeyMode === 'minor'
            ? ENHARMONIC_MINOR
            : ENHARMONIC_MAJOR;

    const replacement = map[currentTargetTonic];

    if (!replacement) return;

    currentTargetTonic = replacement;

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

    // LEVEL 1 (TRANSFORM)
    // LEVEL 1 (NO TRANSFORM — raw krn)

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

    const level2Display = buildLevel2ClefOverrideKrn();

    renderKrn(
        toolkit2,
        level2Display,
        document.getElementById('level2'),
        {
            scale: getNumber('l2ScaleValue'),
            spacing: getNumber('l2SpacingValue')
        },
        computeVerovioTranspose()
    );

}

// ------------------- EVENTS -------------------

async function newPhrase() {

    const family = randomPhrase();

    await loadFamily(family);
    chooseRandomTargetKey();
    updateKeyPill();

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

function chooseRandomTargetKey() {

    const pool = [];

    const source =
        originalKeyMode === 'minor'
            ? MINOR_BY_COUNT
            : MAJOR_BY_COUNT;

    for (const count of enabledCounts) {

        const arr = source[count] || [];

        pool.push(...arr);
    }

    if (!pool.length) return;

    currentTargetTonic =
        pool[Math.floor(Math.random() * pool.length)];

    currentTargetTonic =
        currentTargetTonic.replace(/^([a-g])/, m => m.toUpperCase());
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
    refreshKeyButtonsUI();
    wireFbModeButtons();
    wireScaleSpacing('l0');
    wireScaleSpacing('l1');
    wireScaleSpacing('l2');

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
