// Карточка потребностей с радаром — общая основа для дня, недели и шага
// «Моего пути» (правило «одна механика — один компонент»): пятиугольник
// показывает форму дня целиком, в центре — индекс, ниже — точные оценки.
// Пропущенные потребности не превращаются в нули: вершина остаётся пустой,
// а в списке стоит «—» (правило «никаких заглушек вместо данных»).
import {
  CARD_PAD,
  FOOTER_H,
  beginCard,
  cardFont,
  divider,
  drawRadar,
  drawStatTiles,
  footer,
  header,
  headerHeight,
  resolveCardTheme,
  type StatTile,
} from '../cardKit';

export interface NeedsRadarRow {
  emoji: string;
  label: string;
  /** Цвет потребности ('#hex' или 'var(--…)'). */
  color: string;
  /** 0..10; null — потребность не отмечена. */
  value: number | null;
  /** Отформатированное значение: «7» для дня, «6.4» для недели, «—» без данных. */
  valueText: string;
}

export interface NeedsRadarCardData {
  eyebrow: string;
  title: string;
  subtitle?: string;
  rows: NeedsRadarRow[];
  /** Крупное значение в центре радара — индекс дня/недели. */
  center: { value: string; caption: string };
  /** Плитки под списком («Серия дней», «Дней отмечено»). */
  tiles?: StatTile[];
  footerLabel: string;
  accent?: string;
  accent2?: string;
}

const RADAR_R = 92;
const RADAR_BLOCK = 20 + RADAR_R * 2 + 36;
const LEGEND_ROW = 28;

/** Высота карточки — чистая формула (тестируется без canvas). */
export function needsRadarCardHeight(d: {
  rows: unknown[];
  subtitle?: string;
  tiles?: unknown[];
}): number {
  return (
    headerHeight(1, Boolean(d.subtitle)) +
    RADAR_BLOCK +
    14 +
    d.rows.length * LEGEND_ROW +
    (d.tiles?.length ? 78 : 0) +
    16 +
    FOOTER_H
  );
}

export function drawNeedsRadarCard(
  canvas: HTMLCanvasElement,
  d: NeedsRadarCardData,
) {
  const H = needsRadarCardHeight(d);
  const c = beginCard(canvas, H, { accent: d.accent, accent2: d.accent2 });
  const { ctx, th } = c;

  const contentY = header(c, {
    eyebrow: d.eyebrow,
    title: d.title,
    subtitle: d.subtitle,
  });

  drawRadar(
    c,
    d.rows.map((r) => ({ emoji: r.emoji, color: r.color, value: r.value })),
    {
      cx: c.W / 2,
      cy: contentY + 22 + RADAR_R,
      r: RADAR_R,
      center: d.center,
    },
  );

  // Список оценок: цветная точка → эмодзи → название → значение справа
  const theme = resolveCardTheme();
  let y = contentY + RADAR_BLOCK + 14;
  d.rows.forEach((row, i) => {
    const color = theme.color(row.color);
    const mid = y + LEGEND_ROW / 2;
    if (i > 0) divider(c, y, 0.05);

    ctx.fillStyle = row.value === null ? th.fg(0.18) : color;
    ctx.beginPath();
    ctx.arc(CARD_PAD + 4, mid, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '13px serif';
    ctx.textAlign = 'left';
    ctx.fillText(row.emoji, CARD_PAD + 16, mid + 5);

    ctx.font = cardFont(13);
    ctx.fillStyle = th.fg(row.value === null ? 0.42 : 0.78);
    ctx.fillText(row.label, CARD_PAD + 38, mid + 5);

    ctx.font = cardFont(14, 'bold');
    ctx.fillStyle = row.value === null ? th.fg(0.3) : color;
    ctx.textAlign = 'right';
    ctx.fillText(row.valueText, c.W - CARD_PAD, mid + 5);
    ctx.textAlign = 'left';

    y += LEGEND_ROW;
  });

  if (d.tiles?.length) drawStatTiles(c, d.tiles, y + 12);

  footer(c, d.footerLabel);
}
