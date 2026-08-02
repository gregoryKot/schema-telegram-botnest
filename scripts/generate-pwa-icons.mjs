#!/usr/bin/env node
// Одноразовый скрипт (PWA_PLAN.md фаза 1.3): генерирует иконки PWA из
// существующего webapp/public/favicon.svg. Результат коммитится — скрипт не
// гоняется в CI, только вручную при смене логотипа.
//
// Иконки живут в webapp/public/ (не в schema-miniapp/public/) — сайт и
// мини-апп на одном origin, `webapp/dist/*` раздаётся с корня, а
// `schema-miniapp/dist` копируется в `webapp/dist/app/` (см. Dockerfile).
// Абсолютный путь вида `/icon-192.png` из `/app/manifest.webmanifest`
// резолвится в корень — точно так же уже работает `/telegram-web-app.js`,
// на который ссылается schema-miniapp/index.html. Одна копия иконки вместо
// дублирования в оба public/-каталога.
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const PUBLIC_DIR = join(ROOT, 'webapp', 'public');
const SVG_PATH = join(PUBLIC_DIR, 'favicon.svg');
const APPLE_TOUCH_ICON = join(PUBLIC_DIR, 'apple-touch-icon.png');

// Фон логотипа (см. favicon.svg: тёмный круг на весь viewBox) — используется
// как подложка для maskable-иконки и как заплатка прозрачных углов
// apple-touch-icon (iOS игнорирует альфа-канал и красит прозрачное чёрным/
// белым непредсказуемо).
const BG = '#16121e';

const svg = readFileSync(SVG_PATH);

async function renderAny(size, outPath) {
  // purpose: any — прозрачные углы осознанные (ОС сама решает форму круга).
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(outPath);
  console.log(`✓ ${outPath}`);
}

async function renderMaskable(size, outPath, safeRatio = 0.72) {
  // Maskable-спека: контент обязан помещаться в круг диаметром ~80% холста
  // (safe zone), иначе агрессивная маска лаунчера его обрежет. Круг в
  // favicon.svg упирается в край viewBox — уменьшаем и кладём на подложку
  // цвета фона логотипа, чтобы шов не был виден.
  const inner = Math.round(size * safeRatio);
  const iconBuf = await sharp(svg, { density: 384 })
    .resize(inner, inner)
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: iconBuf, gravity: 'center' }])
    .png()
    .toFile(outPath);
  console.log(`✓ ${outPath}`);
}

async function fixAppleTouchIconIfTransparent() {
  const img = sharp(APPLE_TOUCH_ICON);
  const meta = await img.metadata();
  if (!meta.hasAlpha) {
    console.log('✓ apple-touch-icon.png уже непрозрачный — не трогаю');
    return;
  }
  const stats = await img.stats();
  const alphaChannel = stats.channels[3];
  if (!alphaChannel || alphaChannel.min === 255) {
    console.log('✓ apple-touch-icon.png технически с альфа-каналом, но без прозрачных пикселей — не трогаю');
    return;
  }
  await sharp(APPLE_TOUCH_ICON)
    .flatten({ background: BG })
    .png()
    .toFile(APPLE_TOUCH_ICON + '.tmp');
  const { renameSync } = await import('fs');
  renameSync(APPLE_TOUCH_ICON + '.tmp', APPLE_TOUCH_ICON);
  console.log(
    `✓ apple-touch-icon.png: прозрачные углы залиты фоном ${BG} (iOS игнорирует альфа-канал)`,
  );
}

await renderAny(192, join(PUBLIC_DIR, 'icon-192.png'));
await renderAny(512, join(PUBLIC_DIR, 'icon-512.png'));
await renderMaskable(512, join(PUBLIC_DIR, 'icon-512-maskable.png'));
await fixAppleTouchIconIfTransparent();
