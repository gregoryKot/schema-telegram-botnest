import { buildSummaryText, buildWeeklySummaryText, renderTemplate } from './notification.templates';
import { Need } from '../bot/bot.service';

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '🤝', title: '🤝 Привязанность', fullTitle: 'Привязанность', chartLabel: 'Привязанность' },
  { id: 'autonomy',   emoji: '🚀', title: '🚀 Автономия',     fullTitle: 'Автономия',     chartLabel: 'Автономия' },
  { id: 'expression', emoji: '💬', title: '💬 Выражение',     fullTitle: 'Выражение',     chartLabel: 'Выражение чувств' },
  { id: 'play',       emoji: '🎉', title: '🎉 Спонтанность',  fullTitle: 'Спонтанность',  chartLabel: 'Спонтанность' },
  { id: 'limits',     emoji: '⚖️', title: '⚖️ Границы',      fullTitle: 'Границы',       chartLabel: 'Границы' },
];

describe('buildSummaryText', () => {
  it('shows filled bars for rated needs', () => {
    const text = buildSummaryText(NEEDS, { attachment: 7 });
    expect(text).toContain('🟩'.repeat(7) + '⬜'.repeat(3) + ' 7/10');
  });

  it('shows empty bars with dash for unrated needs', () => {
    const text = buildSummaryText(NEEDS, {});
    expect(text).toContain('⬜'.repeat(10) + ' –');
  });

  it('handles value 0 correctly', () => {
    const text = buildSummaryText(NEEDS, { attachment: 0 });
    expect(text).toContain('⬜'.repeat(10) + ' 0/10');
  });

  it('handles value 10 correctly', () => {
    const text = buildSummaryText(NEEDS, { attachment: 10 });
    expect(text).toContain('🟩'.repeat(10) + ' 10/10');
  });

  it('includes header and legend', () => {
    const text = buildSummaryText(NEEDS, {});
    expect(text).toContain('📔 Трекер потребностей');
    expect(text).toContain('Твои оценки за сегодня 👇');
    expect(text).toContain('Привязанность');
  });
});

describe('buildWeeklySummaryText', () => {
  const makeStats = (overrides: Partial<Record<string, { avg: number | null; prevAvg: number | null }>>) =>
    NEEDS.map((n) => {
      const o = overrides[n.id];
      const avg = o?.avg ?? 5;
      const prevAvg = o?.prevAvg ?? 5;
      const trend =
        avg !== null && prevAvg !== null && avg - prevAvg > 0.5 ? '↑'
        : avg !== null && prevAvg !== null && avg - prevAvg < -0.5 ? '↓'
        : '→';
      return { needId: n.id as any, avg, trend } as any;
    });

  it('shows up trend when avg is significantly higher', () => {
    const stats = makeStats({ attachment: { avg: 8, prevAvg: 5 } });
    const text = buildWeeklySummaryText(stats, NEEDS, null);
    expect(text).toContain('↑');
  });

  it('shows down trend when avg is significantly lower', () => {
    const stats = makeStats({ attachment: { avg: 4, prevAvg: 8 } });
    const text = buildWeeklySummaryText(stats, NEEDS, null);
    expect(text).toContain('↓');
  });

  it('shows dash when avg is null', () => {
    const stats = NEEDS.map((n) => ({ needId: n.id as any, avg: null, trend: '→' as const }));
    const text = buildWeeklySummaryText(stats, NEEDS, null);
    expect(text).toContain(' –');
  });

  it('shows best day when provided', () => {
    const stats = makeStats({});
    const text = buildWeeklySummaryText(stats, NEEDS, 'пятница');
    expect(text).toContain('Лучший день — пятница 🌟');
  });

  it('omits best day line when null', () => {
    const stats = makeStats({});
    const text = buildWeeklySummaryText(stats, NEEDS, null);
    expect(text).not.toContain('Лучший день');
  });

  it('formats averages to 1 decimal place', () => {
    const stats = [{ needId: 'attachment' as any, avg: 7.333, trend: '→' as const },
      ...NEEDS.slice(1).map((n) => ({ needId: n.id as any, avg: 5, trend: '→' as const }))];
    const text = buildWeeklySummaryText(stats, NEEDS, null);
    expect(text).toContain('7.3');
  });
});

describe('renderTemplate', () => {
  it('returns text and keyboard for reminder', () => {
    const result = renderTemplate('reminder');
    expect(result).not.toBeNull();
    expect(result!.text).toBeTruthy();
    expect(result!.keyboard).toBeDefined();
  });

  it('returns null for summary without payload', () => {
    expect(renderTemplate('summary')).toBeNull();
    expect(renderTemplate('summary', {})).toBeNull();
  });

  it('returns text from payload for summary', () => {
    const result = renderTemplate('summary', { text: 'Привет мир' });
    expect(result!.text).toBe('Привет мир');
  });

  it('returns null for weekly without payload text', () => {
    expect(renderTemplate('weekly')).toBeNull();
    expect(renderTemplate('weekly', {})).toBeNull();
  });

  it('returns text from payload for weekly', () => {
    const result = renderTemplate('weekly', { text: 'Итоги недели' });
    expect(result!.text).toBe('Итоги недели');
  });

  it('returns null for unknown type', () => {
    expect(renderTemplate('unknown_type' as any)).toBeNull();
  });

  it.each(['onboarding_1', 'onboarding_3', 'onboarding_7', 'streak_7', 'streak_14', 'streak_30',
    'lapsing_2', 'lapsing_4', 'dormant_7', 'reengagement_30'] as const)(
    'returns non-null result for %s',
    (type) => {
      expect(renderTemplate(type)).not.toBeNull();
    },
  );
});
