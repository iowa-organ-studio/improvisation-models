let historicalSliderValue = 0;

const LILYPOND_KEY_FOLDERS = {
    'C': 'c',
    'G': 'g',
    'F': 'f',
    'D': 'd',
    'Bb': 'bes',
    'A': 'a',
    'Eb': 'ees',
    'E': 'e',
    'Ab': 'aes',
    'B': 'b',
    'Db': 'des',
    'F#': 'fis',
    'Gb': 'ges',
    'C#': 'cis',
    'Cb': 'ces'
};


export function renderLilypondLevel2({
    container,
    currentModel,
    phraseId,
    tonic
}) {
    console.log('LilyPond Level 2 renderer request:', {
        currentModel,
        phraseId,
        tonic
    });

    const lilypondKeyFolder =
        LILYPOND_KEY_FOLDERS[tonic];

    if (!lilypondKeyFolder) {
        container.innerHTML = `
            <div class="lilypond-error">
                No LilyPond key mapping exists for
                <strong>${tonic}</strong>.
            </div>
        `;

        console.error(
            'No LilyPond key-folder mapping for tonic:',
            tonic
        );

        return;
    }

    const stage1Path =
        `./tunes/${currentModel}/lilypond/${phraseId}/${lilypondKeyFolder}/stage1.svg`;

    const stage5Path =
        `./tunes/${currentModel}/lilypond/${phraseId}/${lilypondKeyFolder}/stage5.svg`;

    let viewWidth = 55;

    container.innerHTML = `
        <div class="lilypond-toolbar">

            <div class="lilypond-size-control">
                <span>View</span>

                <button
                    type="button"
                    class="lilypond-size-minus"
                >−</button>

                <span class="lilypond-size-value">
                    55%
                </span>

                <button
                    type="button"
                    class="lilypond-size-plus"
                >+</button>
            </div>

            <div class="lilypond-slider">
                <span>Modern</span>

                <input
                    class="lilypond-range"
                    type="range"
                    min="0"
                    max="100"
                    value="${historicalSliderValue}"
                >

                <span>Historical</span>
            </div>

        </div>

        <div class="lilypond-viewport">

            <div class="lilypond-score">

                <img
                    class="lilypond-stage lilypond-stage1"
                    src="${stage1Path}"
                    alt="Modern notation"
                >

                <img
                    class="lilypond-stage lilypond-stage5"
                    src="${stage5Path}"
                    alt="Historical notation"
                >

            </div>

        </div>
    `;

    const score =
        container.querySelector('.lilypond-score');

    const stage1 =
        container.querySelector('.lilypond-stage1');

    const stage5 =
        container.querySelector('.lilypond-stage5');

    const slider =
        container.querySelector('.lilypond-range');

    const sizeMinus =
        container.querySelector('.lilypond-size-minus');

    const sizePlus =
        container.querySelector('.lilypond-size-plus');

    const sizeValue =
        container.querySelector('.lilypond-size-value');


    function updateOpacity() {
    historicalSliderValue =
        Number(slider.value);

    const amount =
        historicalSliderValue / 100;

    stage1.style.opacity = 1 - amount;
    stage5.style.opacity = amount;
}


    function updateViewWidth() {
        score.style.width = `${viewWidth}%`;
        sizeValue.textContent = `${viewWidth}%`;
    }


    slider.addEventListener(
        'input',
        updateOpacity
    );


    sizeMinus.addEventListener(
        'click',
        () => {
            viewWidth =
                Math.max(20, viewWidth - 5);

            updateViewWidth();
        }
    );


    sizePlus.addEventListener(
        'click',
        () => {
            viewWidth =
                Math.min(150, viewWidth + 5);

            updateViewWidth();
        }
    );


    updateOpacity();
    updateViewWidth();
}

export function lilypondKeyFolderForTonic(tonic) {
    return LILYPOND_KEY_FOLDERS[tonic] || null;
}