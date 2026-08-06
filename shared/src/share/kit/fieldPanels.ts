import { panel, sectionLabel, type Card } from './frame';
import { CARD_PAD, cardFont } from './theme';

/**
 * Стопка блоков «подпись + панель с текстом» — общая механика карточек, где
 * делятся набором заполненных полей (полная запись дневника режимов, личная
 * карточка схемы/режима).
 *
 * Вынесено, потому что цикл отрисовки был скопирован в две карточки слово в
 * слово: правку внесли бы в одну, и картинки разъехались бы (правило №11).
 * Высоту блока считает `fieldPanelsHeight` — тем же арифметическим правилом,
 * иначе карточка обрежет собственный текст.
 */
export interface PanelField {
  label: string;
  /** Уже разбитый на строки текст (см. measureWrap/clampLines). */
  lines: string[];
}

export const PANEL_LINE_H = 20;
export const PANEL_PAD_IN = 14;
export const PANEL_GAP = 16;
/** Высота подписи-рубрики над панелью (sectionLabel + отступ сверху). */
export const PANEL_LABEL_BLOCK = 22;

/** Высота стопки — считается до beginCard, чтобы канвас завести нужного роста. */
export function fieldPanelsHeight(fields: PanelField[]): number {
  return fields.reduce(
    (sum, f) =>
      sum +
      PANEL_LABEL_BLOCK +
      PANEL_PAD_IN * 2 +
      f.lines.length * PANEL_LINE_H +
      PANEL_GAP,
    0,
  );
}

/** Рисует стопку сверху вниз от `y` и возвращает Y под последней панелью. */
export function fieldPanels(c: Card, fields: PanelField[], y: number): number {
  const { ctx, th } = c;
  const panelW = c.W - CARD_PAD * 2;

  for (const f of fields) {
    y = sectionLabel(c, f.label, y + 4, c.accent);
    const panelH = PANEL_PAD_IN * 2 + f.lines.length * PANEL_LINE_H;
    panel(c, CARD_PAD, y, panelW, panelH, 16);

    ctx.font = cardFont(14);
    ctx.fillStyle = th.fg(0.85);
    ctx.textAlign = 'left';
    let ty = y + PANEL_PAD_IN + 11;
    for (const line of f.lines) {
      ctx.fillText(line, CARD_PAD + PANEL_PAD_IN, ty);
      ty += PANEL_LINE_H;
    }
    y += panelH + PANEL_GAP;
  }
  return y;
}
