// Кит share-карточек — единая точка входа (карточки импортируют только его).
// Карточка — лист цветной бумаги оттенка сущности на втором листе (kit/paperFrame.ts),
// шапка Literata со знаком сущности и подвал со знаком продукта (kit/frame.ts), знаки по
// ключам ENTITY_LOOK (kit/signs.ts), чернила значениями светлой темы (kit/ink.ts), текст
// с переносом и многоточием в полях (kit/text.ts), показатели и столбики дня (kit/charts.ts,
// kit/needBars.ts). Единственная копия (правило №3).
export {
  CARD_W,
  CARD_PAD,
  DPR,
  SANS,
  SERIF,
  cardFont,
  serifFont,
  resolveCardTheme,
  withAlpha,
  luminance,
  type CardTheme,
} from './kit/theme';

export {
  FOOTER_H,
  beginCard,
  footer,
  divider,
  drawEmoji,
  panel,
  panelStack,
  sectionLabel,
  sign,
  tracking,
  type Card,
  type CardOpts,
} from './kit/frame';

export {
  HEADER_SIGN_W,
  header,
  headerHeight,
  headerLines,
  measureHeader,
  type HeaderOpts,
} from './kit/header';

export {
  SHEET,
  sheetRect,
  paperHex,
  layerHex,
  sunkHex,
  hueInkHex,
  hueFromColor,
  loadCardFonts,
} from './kit/paperFrame';

export {
  INK,
  PAPER_INK,
  inkOf,
  inkAlpha,
  needDataInk,
  needTextInk,
} from './kit/ink';
export {
  drawSign,
  signHeight,
  canvasSign,
  type CanvasSignKey,
} from './kit/signs';
export { CARD_LOOK, DAY_DONE_HUE, type CardEntity } from './kit/cardLook';

export {
  wrapLines,
  clampLines,
  wrapClamp,
  measureWrap,
  measureClamp,
  drawWrapped,
  type WrapOpts,
} from './kit/text';

export {
  drawStatTiles,
  progressBar,
  STAT_TILE_H,
  type StatTile,
} from './kit/charts';
export {
  drawDayBars,
  dayBarsHeight,
  drawNeedRow,
  NEED_ROW_H,
  type NeedValue,
} from './kit/needBars';
