
async function init() {
  const response = await fetch('landing/models.json');

  if (!response.ok) {
    throw new Error('Could not load landing/models.json');
  }

  const data = await response.json();
  const container = document.querySelector('.models-container');

  container.innerHTML = '';

  data.models.forEach(item => {
    let href;
    let buttonText;

    if (item.type === 'external') {
      href = item.url;
      buttonText = 'Open Trainer →';
    } else if (item.type === 'collection') {
      href = `sublanding.html?collection=${item.collection}`;
      buttonText = 'Choose Variation →';
    } else {
      href = `trainer.html?model=${item.model}`;
      buttonText = 'Start Training →';
    }

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
               src="${item.musicImage}"
               alt="">

          <img class="composer-image"
               src="${item.composerImage}"
               alt="">
        </div>
      </a>
    `;
  });
}

init();
