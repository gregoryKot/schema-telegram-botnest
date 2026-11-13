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
          if (s.out) addSmoothSheet(game, key, img, s.fw, s.fh, s.out);
          else if (!game.textures.exists(key)) game.textures.addSpriteSheet(key, img, { frameWidth: s.fw, frameHeight: s.fh });
        };
        img.src = s.url; // data-URI из чанка — без сетевого запроса
      }
    })
    .catch(() => { /* чанк не доехал — safeAnim guard'ы покроют */ });
}

// Позы копингов нарисованы крупно (190–269 px) — ближайший сосед при масштабе
// 0.24–0.3 давал рябь. Один раз сжимаем кадры сглаженно до размера в кадре.
function addSmoothSheet(game: Phaser.Game, key: string, img: HTMLImageElement, fw: number, fh: number, out: number) {
  const n = Math.round(img.width / fw);
  const canvas = document.createElement('canvas');
  canvas.width = out * n; canvas.height = out;
  const ctx = canvas.getContext('2d');
  const plain = () => { if (!game.textures.exists(key)) game.textures.addSpriteSheet(key, img, { frameWidth: fw, frameHeight: fh }); };
  if (!ctx) { plain(); return; } // без даунскейла, но спрайт будет
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (let i = 0; i < n; i++) ctx.drawImage(img, i * fw, 0, fw, fh, i * out, 0, out, out * (fh / fw));
  const small = new Image();
  small.onload = () => {
    if (!game.textures.exists(key)) game.textures.addSpriteSheet(key, small, { frameWidth: out, frameHeight: out });
  };
  small.onerror = plain;
  small.src = canvas.toDataURL();
}
