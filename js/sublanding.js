async function init() {

    const params = new URLSearchParams(window.location.search);

    const collection = params.get("collection");

    const response = await fetch(
        `sublandings/${collection}/${collection.toLowerCase()}.json`
    );

    const data = await response.json();

    const container = document.getElementById("collection-container");



    // Header card

    container.innerHTML += `
        <div class="model-card collection-header">

            <div class="model-left">

                <h2>${data.title}</h2>

                <p>${data.description}</p>

            </div>

           <div class="model-right">

   <img class="music-image"
     src="${data.heroMusicImage}">

<img class="composer-image"
     src="${data.heroComposerImage}">

</div>

        </div>
    `;

    // Variation cards

    data.items.forEach(item => {

        container.innerHTML += `

           <a class="model-card sub-item"
   href="trainer.html?model=${item.model}">

    <div class="model-left">
        <h2>${item.title}</h2>
        <p>${item.description || ""}</p>

        <div class="launch-button">
            Start Training →
        </div>
    </div>

    <div class="model-right">

        <img class="music-image"
             src="${item.musicImage}">

    </div>

</a>

        `;
    });
}

init();