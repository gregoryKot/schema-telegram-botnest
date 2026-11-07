#!/usr/bin/env node
// Иконки сайта из знака «Всё по схеме» (shared/src/share/kit/brandMark.ts): favicon.svg и
// PNG в webapp/public. Результат коммитится — скрипт не гоняется в CI, только вручную при
// смене знака: `node scripts/generate-pwa-icons.mjs` (Node ≥ 22.18 сам снимает типы с .ts).
// Сверка favicon.svg с модулем знака и безопасной зоны maskable —
// webapp/src/components/art/BrandMark.test.tsx; размеры и непрозрачность PNG —
// webapp/src/pwaManifest.test.ts. Иконки визитки (*-personal*) этот скрипт не трогает.
//
// Иконки живут в webapp/public/ — `webapp/dist/*` раздаётся с корня, путь
// вида `/icon-192.png` из манифеста резолвится в корень.
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { BRAND_HEX, brandMarkSvg } from '../shared/src/share/kit/brandMark.ts';

const PUBLIC_DIR = join(import.meta.dirname, '..', 'webapp', 'public');

// Вкладка браузера и выдача поисковика — 16–32 px: простой знак, без полоски фона.
const FAVICON = brandMarkSvg({ simple: true });
// Плитка со скруглёнными углами, углы прозрачные (purpose: any — форму решает ОС).
const TILE = brandMarkSvg();
// Квадрат без скругления: маску накладывает система (maskable у Android; iOS скругляет
// apple-touch-icon сам). Дуга и круг целиком внутри безопасной зоны — круга 80 % холста.
const BLEED = brandMarkSvg({ bleed: true });

async function png(svg, size, name, { opaque = false } = {}) {
  let img = sharp(Buffer.from(svg), { density: 384 }).resize(size, size);
  // iOS и маска лаунчера красят прозрачное чёрным: заливаем бумагой, альфа-канал уходит.
  if (opaque) img = img.flatten({ background: BRAND_HEX.paper });
  await img.png().toFile(join(PUBLIC_DIR, name));
  console.log(`✓ ${name}`);
}

writeFileSync(join(PUBLIC_DIR, 'favicon.svg'), FAVICON);
console.log('✓ favicon.svg');
await png(FAVICON, 96, 'favicon-96.png');
await png(TILE, 192, 'icon-192.png');
await png(TILE, 512, 'icon-512.png');
await png(BLEED, 512, 'icon-512-maskable.png', { opaque: true });
await png(BLEED, 180, 'apple-touch-icon.png', { opaque: true });
