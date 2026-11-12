// @vitest-environment jsdom
// Каталог всех карточек шаринга (b23a): каждая draw*-функция из ./*Card.ts рисуется на
// подменённом контексте с длинными реальными по форме данными, и
//  • ни одна строка fillText не выходит за внутренние поля листа [CARD_PAD, W − CARD_PAD]
//    и за его низ (мера — кегль текущего шрифта, canvas.test-helpers.ts);
//  • ни одна строка не несёт эмодзи (знаки — бумагой, docs/design/APP_2026-11.md, принцип 7).
// Новая карточка без строки в CATALOG краснеет: так тест не отстаёт от каталога. Исключений
// нет (карточки b23b — достижения, «Мой путь», приглашения — перешли на знаки).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { canvasWithMockCtx, textSpan } from './canvas.test-helpers';
import { CARD_PAD, CARD_W, sheetRect } from '../cardKit';
import { drawAchievementCard } from './achievementCard';
import { drawAchievementsCard } from './achievementsCard';
import { drawDayCard } from './dayCard';
import { drawDiaryCard } from './diaryCard';
import { drawGratitudeCard } from './gratitudeCard';
import { drawInviteCard } from './inviteCard';
import { drawJourneyCard } from './journeyCard';
import { drawJourneyItemCard } from './journeyItemCard';
import { drawJourneyResultCard } from './journeyResultCard';
import { drawJourneyTotalsCard } from './journeyTotalsCard';
import { drawModeEntryCard } from './modeEntryCard';
import { drawModeEntryFullCard } from './modeEntryFullCard';
import { buildMonthGrid, drawMonthCard } from './monthCard';
import { drawNeedsDayCard } from './needsDayCard';
import { drawNoteCard } from './noteCard';
import { drawPhraseCheckCard } from './phraseCheckCard';
import { drawPhraseCheckFullCard } from './phraseCheckFullCard';
import { drawPracticeCard } from './practiceCard';
import { drawSchemaCard } from './schemaCard';
import { drawStreakCard } from './streakCard';
import { drawWeeklyCard } from './weeklyCard';
import { buildYsqProfile, drawYsqProfileCard } from './ysqProfileCard';
import { SCHEMAS } from '../../hooks/ysqSchemas';
import type { Need } from '../../types';

afterEach(() => vi.restoreAllMocks());

const LONG =
  'Коллега не ответил на сообщение, и весь вечер кажется, что со мной что-то не так, хотя молчание — не приговор и у человека может быть просто занятой день, а тело всё равно сжимается';
const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привязанность',
  },
  { id: 'autonomy', emoji: '🚀', title: 'Автономия', chartLabel: 'Автономия' },
  {
    id: 'expression',
    emoji: '💬',
    title: 'Выражение чувств',
    chartLabel: 'Выражение чувств',
  },
  {
    id: 'play',
    emoji: '🎉',
    title: 'Спонтанность',
    chartLabel: 'Спонтанность',
  },
  { id: 'limits', emoji: '⚖️', title: 'Границы', chartLabel: 'Границы' },
];
const RATINGS = { attachment: 3, autonomy: 6, expression: 10, play: 5 };
const HISTORY = ['2026-11-06', '2026-11-08', '2026-11-09', '2026-11-12'].map(
  (date, i) => ({
    date,
    ratings: {
      attachment: 2 + i,
      autonomy: 6,
      expression: 9,
      play: 1,
      limits: 8,
    },
  }),
);
const YSQ = Object.fromEntries(
  SCHEMAS.map((s) => [s.name, { pct5plus: 0.9, avg: 5.4 }]),
);

type Draw = (canvas: HTMLCanvasElement) => void;
const CATALOG: Record<string, Draw> = {
  drawAchievementCard: (c) =>
    drawAchievementCard(c, {
      id: 'streak_7',
      title: 'Первая неделя подряд без пропусков и перерывов',
      desc: LONG,
    }),
  drawAchievementsCard: (c) =>
    drawAchievementsCard(c, [
      { id: 'first_day', earned: true },
      { id: 'streak_100', earned: false },
      { id: 'total_50', earned: true },
      { id: 'growth', earned: false },
      { id: 'pair_connected', earned: true },
    ]),
  drawDayCard: (c) => drawDayCard(c, NEEDS, RATINGS, '12 ноября'),
  drawDiaryCard: (c) =>
    drawDiaryCard(c, {
      emoji: '📓',
      title: 'Мой дневник',
      color: 'var(--c-rose)',
      count: 1234,
      since: '3 ноября',
    }),
  drawGratitudeCard: (c) =>
    drawGratitudeCard(c, [LONG, 'Утреннему кофе', LONG, LONG], '12 ноября'),
  drawInviteCard: (c) =>
    drawInviteCard(c, {
      kind: 'pair',
      title: 'Приглашение в пару',
      code: 'PAIR7K2MWWWW',
      hint: LONG,
    }),
  drawInviteCardApp: (c) =>
    drawInviteCard(c, { kind: 'app', title: 'Всё по схеме', hint: LONG }),
  drawInviteCardTherapist: (c) =>
    drawInviteCard(c, {
      kind: 'therapist',
      title: 'Приглашение от терапевта с очень длинным названием',
      hint: LONG,
    }),
  drawJourneyCard: (c) =>
    drawJourneyCard(
      c,
      [
        { label: LONG, day: '3 мая', hue: 195, sign: 'pebbles' },
        { label: 'Запись', day: '30 сентября', hue: null, sign: null },
      ],
      12,
    ),
  drawJourneyItemCard: (c) =>
    drawJourneyItemCard(c, {
      label: 'Заземление 5-4-3-2-1 и ещё очень длинное название шага',
      sub: LONG,
      day: '3 мая',
      hue: 135,
      sign: 'grounded',
    }),
  drawJourneyResultCard: (c) =>
    drawJourneyResultCard(c, {
      label: 'Схемный дневник',
      day: '3 мая',
      hue: 28,
      sign: 'layers',
      parts: [
        { title: 'Ситуация', text: LONG },
        { title: 'Здоровый взгляд', text: LONG },
        { text: LONG },
      ],
    }),
  drawJourneyTotalsCard: (c) =>
    drawJourneyTotalsCard(
      c,
      [
        { type: 'tracker_day', label: 'Дни с трекером', count: 64 },
        { type: 'future', label: LONG, count: 12345 },
      ],
      64,
      { title: 'Мой месяц', subtitle: LONG },
    ),
  drawModeEntryCard: (c) =>
    drawModeEntryCard(c, {
      group: 'Детские',
      color: '#b06f4a',
      name: 'Уязвимый Ребёнок',
      emoji: '🧒',
      healthyResponse: LONG,
    }),
  drawModeEntryFullCard: (c) =>
    drawModeEntryFullCard(c, {
      color: '#5d6d8a',
      name: 'Отстранённый Защитник',
      emoji: '🛡',
      dateLabel: '12 ноября',
      fields: [
        { label: 'Ситуация', text: LONG },
        { label: 'Мысли', text: LONG },
      ],
    }),
  drawMonthCard: (c) =>
    drawMonthCard(
      c,
      buildMonthGrid(new Set(['2026-11-10', '2026-11-12']), '2026-11-12'),
      64,
      '16 окт — 12 ноя',
    ),
  drawNeedsDayCard: (c) =>
    drawNeedsDayCard(c, {
      eyebrow: 'Трекер потребностей',
      title: 'Мой день',
      subtitle: '12 ноября',
      footerLabel: 'Мой путь',
      rows: NEEDS.map((n) => ({
        id: n.id,
        label: n.chartLabel,
        value: null,
        valueText: '—',
      })),
      center: { value: '—', caption: 'индекс' },
    }),
  drawNoteCard: (c) =>
    drawNoteCard(c, {
      color: '#b06f4a',
      title: 'Покинутость / Нестабильность привязанностей',
      subtitle: 'Отчуждение и отвержение',
      fields: [{ label: 'Что включает', text: LONG }],
      hue: 28,
      sign: 'layers',
    }),
  drawPhraseCheckCard: (c) =>
    drawPhraseCheckCard(c, { phrase: LONG, rewrite: LONG }),
  drawPhraseCheckFullCard: (c) =>
    drawPhraseCheckFullCard(c, {
      phrase: LONG,
      marks: ['goal', 'notok', 'person', 'label'],
      rewrite: LONG,
    }),
  drawPracticeCard: (c) =>
    drawPracticeCard(
      c,
      {
        id: 'breathing',
        emoji: '🌬',
        title: 'Дыхание 4-4-6',
        subtitle:
          'Вдох короче выдоха — так тело получает сигнал, что опасность миновала и можно отпустить напряжение',
        steps: [
          { emoji: '🌬️', title: 'Вдохни на 4 счёта' },
          { emoji: '⏸️', title: LONG },
          { emoji: '💨', title: 'Выдохни на 6 счётов' },
        ],
      },
      'прошли 6 раз',
    ),
  drawSchemaCard: (c) =>
    drawSchemaCard(c, {
      domain: 'Отчуждение и отвержение',
      domainColor: 'var(--c-clay)',
      name: 'Эмоциональная депривация',
      desc: LONG,
      belief: LONG,
    }),
  drawStreakCard: (c) => drawStreakCard(c, 12),
  drawWeeklyCard: (c) => drawWeeklyCard(c, NEEDS, HISTORY, 12),
  drawYsqProfileCard: (c) =>
    drawYsqProfileCard(c, buildYsqProfile(YSQ), {
      headline: '20 выраженных схем из 20',
      dateLabel: '7 ноября 2026 г.',
    }),
};

const EMOJI = /\p{Extended_Pictographic}/u;

function render(draw: Draw) {
  const { canvas, ctx } = canvasWithMockCtx();
  draw(canvas);
  return { ctx, H: canvas.height / 3 };
}

describe('каталог карточек', () => {
  it('у каждой draw*Card из ./*Card.ts есть строка в CATALOG', () => {
    const mods = import.meta.glob('./*Card.ts', { eager: true }) as Record<
      string,
      Record<string, unknown>
    >;
    const draws = Object.values(mods).flatMap((m) =>
      Object.keys(m).filter((k) => /^draw\w+Card$/.test(k)),
    );
    expect(draws.length).toBeGreaterThan(20);
    expect(draws.filter((k) => !(k in CATALOG))).toEqual([]);
  });

  it.each(Object.keys(CATALOG))(
    '%s рисуется без падений и с текстом',
    (name) => {
      const { ctx } = render(CATALOG[name]);
      expect(ctx.printed.length).toBeGreaterThan(0);
    },
  );
});

/** Строки за полями листа: подпись строки, позиция и ширина — для сообщения теста. */
function outside(draw: Draw): string[] {
  const { ctx, H } = render(draw);
  const sheet = sheetRect(CARD_W, H);
  return ctx.printed
    .filter((p) => {
      const [l, r] = textSpan(p);
      return (
        l < CARD_PAD - 0.5 ||
        r > CARD_W - CARD_PAD + 0.5 ||
        p.y > sheet.y + sheet.h - 10 ||
        p.y < sheet.y + 10
      );
    })
    .map(
      (p) =>
        `${p.text} @${Math.round(p.x)},${Math.round(p.y)} w${Math.round(p.width)}`,
    );
}

describe('текст в полях листа', () => {
  it.each(Object.keys(CATALOG))('%s', (name) => {
    expect(outside(CATALOG[name])).toEqual([]);
  });

  it('контрольный образец: неперенесённая строка и строка под листом ловятся', () => {
    const wide: Draw = (canvas) => {
      const ctx = canvas.getContext('2d')!;
      canvas.height = 300 * 3;
      ctx.font = '14px sans-serif';
      ctx.fillText(LONG, CARD_PAD, 100);
      ctx.fillText('низ', CARD_PAD, 299);
    };
    expect(outside(wide)).toHaveLength(2);
  });
});

describe('нет эмодзи', () => {
  it.each(Object.keys(CATALOG))('%s', (name) => {
    const { ctx } = render(CATALOG[name]);
    expect(
      ctx.printed.filter((p) => EMOJI.test(p.text)).map((p) => p.text),
    ).toEqual([]);
  });

  it('регулярка ловит эмодзи и пропускает текст (контрольный образец)', () => {
    expect(EMOJI.test('12 🔥')).toBe(true);
    expect(EMOJI.test('Мой день — 6,2 · «было → стало»')).toBe(false);
  });
});
