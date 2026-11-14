import Phaser from 'phaser';
// Тяжёлые спрайты — отдельным чанком в общий TextureManager, пока человек в меню;
// не доехал — сцены создают анимацию при первом использовании (safeAnim).
export function loadHeavySprites(game: Phaser.Game) {
  import('./sprites-heavy')
    .then(({ HEAVY_SHEETS }) => {
      for (const [key, s] of Object.entries(HEAVY_SHEETS)) {
        if (game.textures.exists(key)) continue;
        const img = new Image();
        img.onload = () => {
          if (!game.textures.exists(key))
            game.textures.addSpriteSheet(key, img, {
              frameWidth: s.fw,
              frameHeight: s.fh,
            });
        };
        img.src = s.url; // data-URI из чанка — без сетевого запроса
      }
    })
    .catch(() => {
      /* чанк не доехал — safeAnim guard'ы покроют */
    });
}
