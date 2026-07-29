// Кит share-карточек — единая точка входа (карточки импортируют только его).
// Сам кит разбит по смыслу: тема (цвета из CSS-переменных фронта), рамка
// (фон, шапка, футер, панели), текст (перенос/обрезка) и графика (радар,
// плитки, полоски). Единственная копия для обоих фронтендов (правило №3).
export {
  CARD_W,
  CARD_PAD,
  DPR,
  cardFont,
  resolveCardTheme,
  withAlpha,
  luminance,
  type CardTheme,
} from './kit/theme';

export {
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  footer,
  divider,
  drawEmoji,
  panel,
  sectionLabel,
  tracking,
  type Card,
  type CardOpts,
  type HeaderOpts,
} from './kit/frame';

export {
  wrapLines,
  clampLines,
  measureWrap,
  drawWrapped,
  type WrapOpts,
} from './kit/text';

export {
  drawRadar,
  drawStatTiles,
  progressBar,
  axisPoint,
  valueRadius,
  type RadarPoint,
  type RadarOpts,
  type StatTile,
} from './kit/charts';
