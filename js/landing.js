async function init() {

    const response = await fetch('landing/models.json');
    const data = await response.json();

    const container = document.querySelector('.models-container');

    container.innerHTML = '';

    data.models.forEach(item => {

        const href =
            item.type === 'collection'
                ? `sublanding.html?collection=${item.collection}`
                : `trainer.html?model=${item.model}`;

        const buttonText =
            item.type === 'collection'
                ? 'Choose Variation →'
                : 'Start Training →';

        container.innerHTML += `
            <a class="model-card" href="${href}">

                <div class="model-left">

                    <h2>${item.title}</h2>

                    <p>${item.description}</p>

                    <div class="launch-button">
                        ${buttonText}
                    </div>

                </div>

                <div class="model-right">

                    <img class="music-image"
                         src="${item.musicImage}">

                    <img class="composer-image"
                         src="${item.composerImage}">

                </div>

            </a>
        `;
    });
}

init();