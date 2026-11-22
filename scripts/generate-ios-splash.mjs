// Картинки запуска iOS (apple-touch-startup-image): установленное на iPhone/iPad приложение
// показывает их до прихода index.html. Кадр повторяет экран загрузки #boot из webapp/index.html:
// знак 88 pt на том же месте, фон — --bg темы. Подпись не рисуется: её шрифт у iOS свой.
// Запускается из generate-pwa-icons.mjs; PNG и блок тегов в index.html коммитятся.
import sharp from 'sharp';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BRAND_HEX, brandMarkSvg } from '../shared/src/share/kit/brandMark.ts';

const WEBAPP = join(import.meta.dirname, '..', 'webapp');
const OUT_DIR = join(WEBAPP, 'public', 'splash');
const INDEX_HTML = join(WEBAPP, 'index.html');

// [ширина, высота, плотность, высота статус-бара] в pt, портрет. Статус-бар — приближённо:
// страница в standalone начинается под ним, и от него зависит, где встанет знак #boot.
const DEVICES = [
  [375, 667, 2, 20], // iPhone SE 2/3, 8
  [414, 736, 3, 20], // iPhone 8 Plus
  [375, 812, 3, 44], // iPhone X, XS, 11 Pro, 12/13 mini
  [414, 896, 2, 48], // iPhone XR, 11
  [414, 896, 3, 44], // iPhone XS Max, 11 Pro Max
  [390, 844, 3, 47], // iPhone 12, 13, 14, 16e
  [428, 926, 3, 47], // iPhone 12/13 Pro Max, 14 Plus
  [393, 852, 3, 54], // iPhone 14 Pro, 15, 15 Pro, 16
  [430, 932, 3, 54], // iPhone 14 Pro Max, 15/16 Plus, 15 Pro Max
  [402, 874, 3, 62], // iPhone 16 Pro, 17, 17 Pro
  [440, 956, 3, 62], // iPhone 16 Pro Max, 17 Pro Max
  [420, 912, 3, 62], // iPhone Air
  [744, 1133, 2, 24], // iPad mini 6+
  [768, 1024, 2, 20], // iPad 9.7, mini 5
  [810, 1080, 2, 20], // iPad 10.2
  [820, 1180, 2, 24], // iPad 10.9, Air 11
  [834, 1112, 2, 20], // iPad Pro 10.5, Air 3
  [834, 1194, 2, 24], // iPad Pro 11
  [834, 1210, 2, 24], // iPad Pro 11 (M4)
  [1024, 1366, 2, 24], // iPad Pro 12.9, Air 13
  [1032, 1376, 2, 24], // iPad Pro 13 (M4)
];

// Вёрстка #boot: колонка «знак 88 + отступ 16 + строка 24» по центру области без нижних 8vh.
const MARK = 88;
const COLUMN = MARK + 16 + 24;
const markTop = (h, bar) => bar + ((h - bar) * 0.92 - COLUMN) / 2;

const darkBg = /html\[data-theme="dark"\]\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6});/i.exec(
  readFileSync(join(WEBAPP, 'src', 'index.css'), 'utf8'),
)?.[1];
if (!darkBg) throw new Error('не нашёл --bg тёмной темы в webapp/src/index.css');
const THEMES = { light: BRAND_HEX.paper, dark: darkBg };

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const tags = [];
let bytes = 0;
for (const [w, h, dpr, bar] of DEVICES) {
  const size = MARK * dpr;
  const mark = await sharp(Buffer.from(brandMarkSvg()), { density: 384 }).resize(size, size).png().toBuffer();
  for (const [theme, background] of Object.entries(THEMES)) {
    const name = `${w}x${h}-${dpr}x-${theme}.png`;
    const file = await sharp({ create: { width: w * dpr, height: h * dpr, channels: 3, background } })
      .composite([{ input: mark, left: Math.round(((w - MARK) / 2) * dpr), top: Math.round(markTop(h, bar) * dpr) }])
      .png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 })
      .toBuffer();
    writeFileSync(join(OUT_DIR, name), file);
    bytes += file.length;
    tags.push(
      `    <link rel="apple-touch-startup-image" href="/splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${theme})" />`,
    );
  }
}

const START = '    <!-- ios-splash:start (пишет scripts/generate-ios-splash.mjs) -->';
const END = '    <!-- ios-splash:end -->';
const html = readFileSync(INDEX_HTML, 'utf8');
const [from, to] = [html.indexOf(START), html.indexOf(END)];
if (from < 0 || to < 0) throw new Error('в webapp/index.html нет меток ios-splash:start/end');
writeFileSync(INDEX_HTML, html.slice(0, from) + [START, ...tags].join('\n') + '\n' + html.slice(to));
console.log(`✓ splash: ${tags.length} PNG, ${Math.round(bytes / 1024)} КБ`);
