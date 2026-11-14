
let historicalSliderValue = 0;
let lilypondViewWidth = 100;

// Keep one active observer per rendered container.
// A new phrase replaces its DOM.
const resizeObservers = new WeakMap();

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

function layoutForWidth(width) {
    if (width >= 1000) return 'wide';
    if (width >= 600) return 'medium';
    return 'narrow';
}

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

    // Disconnect the previous observer before replacing the DOM.
    resizeObservers.get(container)?.disconnect();
    resizeObservers.delete(container);

    const lilypondKeyFolder = LILYPOND_KEY_FOLDERS[tonic];

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

    const basePath =
        `./tunes/${currentModel}/lilypond/${phraseId}/${lilypondKeyFolder}`;

    const isVenetian = currentModel === 'Venetian-Toccata';

    let viewWidth = lilypondViewWidth;

    container.innerHTML = `
        <div class="lilypond-toolbar">

            <div class="lilypond-size-control">
                <span>View</span>

                <button
                    type="button"
                    class="lilypond-size-minus"
                >−</button>

                <span class="lilypond-size-value">
                    ${viewWidth}%
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
                    alt="Modern notation"
                >

                <img
                    class="lilypond-stage lilypond-stage5"
                    alt="Historical notation"
                >

            </div>

        </div>
    `;

    const viewport =
        container.querySelector('.lilypond-viewport');

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

    let currentLayout = null;
    let initialFrame = null;
    let initialRetryFrame = null;
    let disposed = false;

    // -----------------------------------------
    // SVG LAYOUT SELECTION
    // -----------------------------------------

    function updateSources() {

        if (disposed) return;

        // Measure the available viewport, NOT the score.
        // The score width is controlled by the View percentage.
        const availableWidth =
            viewport.getBoundingClientRect().width ||
            container.getBoundingClientRect().width;

        // Do not choose a layout while the element has no width.
        if (!Number.isFinite(availableWidth) ||
            availableWidth <= 0) {
            return;
        }

        const layout =
            isVenetian
                ? layoutForWidth(availableWidth)
                : null;

        // Do not reload the SVGs unless the layout changes.
        if (layout === currentLayout) return;

        currentLayout = layout;

        const path =
            layout
                ? `${basePath}/${layout}`
                : basePath;

        stage1.src = `${path}/stage1.svg`;
        stage5.src = `${path}/stage5.svg`;

        console.log(
            'LilyPond SVG layout:',
            layout || 'original',
            'viewport width:',
            availableWidth
        );
    }

    // -----------------------------------------
    // MODERN / HISTORICAL SLIDER
    // -----------------------------------------

    function updateOpacity() {

        historicalSliderValue = Number(slider.value);

        const amount = historicalSliderValue / 100;

        stage1.style.opacity = 1 - amount;
        stage5.style.opacity = amount;
    }

    // -----------------------------------------
    // VIEW WIDTH
    // -----------------------------------------

    function updateViewWidth() {

        lilypondViewWidth = viewWidth;

        score.style.width = `${viewWidth}%`;

        sizeValue.textContent = `${viewWidth}%`;
    }

    // -----------------------------------------
    // EVENT LISTENERS
    // -----------------------------------------

    slider.addEventListener('input', updateOpacity);

    sizeMinus.addEventListener('click', () => {

        viewWidth = Math.max(20, viewWidth - 5);

        updateViewWidth();
    });

    sizePlus.addEventListener('click', () => {

        viewWidth = Math.min(150, viewWidth + 5);

        updateViewWidth();
    });

    // -----------------------------------------
    // INITIALIZE CONTROLS
    // -----------------------------------------

    updateOpacity();
    updateViewWidth();

    // -----------------------------------------
    // RESPONSIVE RESIZE OBSERVER
    // -----------------------------------------

    if (isVenetian &&
        typeof ResizeObserver !== 'undefined') {

        const observer = new ResizeObserver(() => {
            updateSources();
        });

        observer.observe(viewport);

        resizeObservers.set(container, observer);
    }

    // -----------------------------------------
    // INITIAL MEASUREMENT AFTER LAYOUT
    // -----------------------------------------

    // Initial measurement after layout
    function initializeLayout() {
        if (disposed) return;

        updateSources();

        // Recheck after the page has fully loaded.
        if (document.readyState === 'complete') {
            updateSources();
        } else {
            window.addEventListener('load', updateSources, {
                once: true
            });
        }
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(initializeLayout);
    });

    // Non-Venetian LilyPond models retain the original
    // SVG paths and also receive an initial measurement.

    // -----------------------------------------
    // CLEANUP FOR FUTURE RENDERS
    // -----------------------------------------

    // Store cleanup information with the observer
    // so pending animation frames from an old phrase
    // cannot update a newly rendered phrase.

    const previousObserver = resizeObservers.get(container);

    if (previousObserver) {
        const originalDisconnect =
            previousObserver.disconnect.bind(previousObserver);

        previousObserver.disconnect = () => {
            disposed = true;

            if (initialFrame !== null) {
                cancelAnimationFrame(initialFrame);
            }

            if (initialRetryFrame !== null) {
                cancelAnimationFrame(initialRetryFrame);
            }

            originalDisconnect();
        };
    }
}

export function lilypondKeyFolderForTonic(tonic) {
    return LILYPOND_KEY_FOLDERS[tonic] || null;
}
