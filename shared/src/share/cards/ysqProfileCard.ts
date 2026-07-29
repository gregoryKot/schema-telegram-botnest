// Карточка-профиль результата теста на схемы: все 20 схем горизонтальными
// барами по среднему баллу (1–6), сгруппированы по пяти потребностям (цвет
// группы — цвет потребности), выраженные схемы подсвечены ярче, пунктир — порог
// «4 из 6». Персональные данные — только агрегаты (средние баллы по схемам),
// без ответов на отдельные вопросы.
//
// Чистая логика (подписи, группировка, высота) отделена от canvas-отрисовки и
// покрыта тестами schema-miniapp/src/share/cards/ysqProfileCard.test.ts.
import {
  CARD_PAD,
  CARD_W,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  footer,
  cardFont,
  tracking,
  progressBar,
  measureWrap,
} from '../cardKit';
import { COLORS } from '../../types';
import { SCHEMAS, DOMAIN_ORDER, NEED_LABELS } from '../../hooks/ysqSchemas';
import { isSchemaScoreActive, avgBarPct } from '../../hooks/ysqScoring';

export interface YsqProfileRow {
  label: string;
  /** Средний балл 1–6; 0 = нет ответов (бар не рисуется, значение «—»). */
  avg: number;
  active: boolean;
}

export interface YsqProfileDomain {
  needId: string;
  label: string;
  /** hex-цвет потребности (COLORS) — общий для шапки группы и её баров. */
  color: string;
  rows: YsqProfileRow[];
}

// Полные названия схем не влезают в колонку карточки (~150px) — явные короткие
// подписи там, где обрезка по «/» теряет смысл или ничего не даёт.
const SHORT_LABELS: Record<string, string> = {
  'Дефективность/Стыд': 'Дефективность, стыд',
  'Страх потери контроля над эмоциями': 'Страх потери контроля',
  'Жёсткие стандарты/Придирчивость': 'Жёсткие стандарты',
  'Негативизм/Пессимизм': 'Негативизм, пессимизм',
  'Пунитивность (на себя)': 'Пунитивность к себе',
  'Пунитивность (на других)': 'Пунитивность к другим',
};

/** Короткая подпись схемы для строки профиля (≤ 21 символ). */
export function shortSchemaLabel(name: string): string {
  const short = SHORT_LABELS[name] ?? name.split('/')[0].trim();
  return short
    .replace('Эмоциональная ', 'Эмоц. ')
    .replace('Социальная ', 'Соц. ')
    .replace('Недостаточность ', 'Недост. ');
}

/**
 * Полный профиль для карточки: домены в порядке DOMAIN_ORDER, внутри домена
 * схемы по убыванию среднего балла. Активность — оба критерия скоринга
 * (isSchemaScoreActive). Отсутствующий счёт схемы — защитный ноль, не активна.
 */
export function buildYsqProfile(
  scores: Record<string, { pct5plus: number; avg: number }>,
): YsqProfileDomain[] {
  return DOMAIN_ORDER.map((needId) => ({
    needId,
    label: NEED_LABELS[needId],
    color: COLORS[needId] ?? '#a78bfa',
    rows: SCHEMAS.filter((s) => s.needId === needId)
      .map((s) => {
        const sc = scores[s.name] ?? { pct5plus: 0, avg: 0 };
        return {
          label: shortSchemaLabel(s.name),
          avg: sc.avg,
          active: isSchemaScoreActive(sc),
        };
      })
      .sort((a, b) => b.avg - a.avg),
  })).filter((d) => d.rows.length > 0);
}

// Геометрия строк профиля. Значение (х.х) прижато к правому краю, бар между
// колонкой названий и значением.
const NAME_W = 150;
const BAR_X = CARD_PAD + NAME_W + 8;
const BAR_W = CARD_W - CARD_PAD - 34 - BAR_X;
const ROW_H = 26;
const GROUP_HEAD_H = 26;
const GROUP_GAP = 8;
// Пояснительная строка под шапкой («средний балл от 1 до 6 · …»).
const HINT_H = 30;

/**
 * Высота карточки — чистая формула от числа доменов и строк (для тестов).
 * titleLines обязателен: заголовок «Выраженных схем не обнаружено» переносится
 * на две строки, и с расчётом «как будто строка одна» последняя группа схем
 * уезжает под футер.
 */
export function ysqProfileCardHeight(
  domains: YsqProfileDomain[],
  hasDate = true,
  titleLines = 1,
): number {
  const rows = domains.reduce((n, d) => n + d.rows.length, 0);
  return (
    headerHeight(titleLines, hasDate) +
    HINT_H +
    domains.length * (GROUP_HEAD_H + GROUP_GAP) +
    rows * ROW_H +
    12 +
    FOOTER_H
  );
}

export interface YsqProfileCardOpts {
  /** «N выраженных схем из 20» / «Выраженных схем не обнаружено». */
  headline: string;
  dateLabel: string | null;
}

export function drawYsqProfileCard(
  canvas: HTMLCanvasElement,
  domains: YsqProfileDomain[],
  opts: YsqProfileCardOpts,
) {
  const titleLines = Math.min(
    2,
    measureWrap(canvas, opts.headline, CARD_W - CARD_PAD * 2, 23, 'bold').length,
  );
  const H = ysqProfileCardHeight(
    domains,
    Boolean(opts.dateLabel),
    titleLines,
  );
  const c = beginCard(canvas, H, {
    accent: 'var(--accent)',
    accent2: 'var(--accent-blue)',
  });
  const { ctx, th } = c;

  const contentY = header(c, {
    eyebrow: 'Тест на схемы',
    title: opts.headline,
    subtitle: opts.dateLabel ?? undefined,
  });

  ctx.font = cardFont(10.5);
  ctx.fillStyle = th.fg(0.4);
  ctx.textAlign = 'left';
  ctx.fillText(
    'Средний балл от 1 до 6 · ярче — выраженные схемы',
    CARD_PAD,
    contentY,
  );

  const chartTop = contentY + HINT_H;
  const chartBottom = H - FOOTER_H - 8;

  // Пунктир порога «4 из 6» с меткой; закрашенная часть бара ложится поверх,
  // так что линия видна только там, куда бар не дотянулся.
  const thresholdX = BAR_X + (avgBarPct(4) / 100) * BAR_W;
  ctx.font = cardFont(9);
  ctx.fillStyle = th.fg(0.35);
  ctx.textAlign = 'center';
  ctx.fillText('4', thresholdX, chartTop - 4);
  ctx.textAlign = 'left';
  ctx.strokeStyle = th.fg(0.16);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(thresholdX, chartTop);
  ctx.lineTo(thresholdX, chartBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  let y = chartTop;
  for (const d of domains) {
    ctx.beginPath();
    ctx.arc(CARD_PAD + 3, y + 13, 3, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.font = cardFont(10, 'bold');
    ctx.fillStyle = th.fg(0.6);
    tracking(ctx, 0.6);
    ctx.fillText(d.label.toUpperCase(), CARD_PAD + 12, y + 16);
    tracking(ctx, 0);
    y += GROUP_HEAD_H;

    for (const r of d.rows) {
      ctx.font = cardFont(11.5, r.active ? 'bold' : undefined);
      ctx.fillStyle = th.fg(r.active ? 0.92 : 0.5);
      ctx.textAlign = 'left';
      ctx.fillText(r.label, CARD_PAD, y + 15);

      const pct = r.avg >= 1 ? avgBarPct(r.avg) / 100 : 0;
      ctx.save();
      ctx.globalAlpha = r.active ? 1 : 0.4;
      progressBar(c, BAR_X, y + 8, BAR_W, pct, d.color);
      ctx.restore();

      ctx.font = cardFont(11, r.active ? 'bold' : undefined);
      ctx.fillStyle = r.active ? d.color : th.fg(0.4);
      ctx.textAlign = 'right';
      ctx.fillText(
        r.avg >= 1 ? r.avg.toFixed(1) : '—',
        CARD_W - CARD_PAD,
        y + 16,
      );
      ctx.textAlign = 'left';

      y += ROW_H;
    }
    y += GROUP_GAP;
  }

  footer(c, 'Тест на схемы');
}
