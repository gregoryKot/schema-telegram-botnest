import {
  THERAPY_NUDGE_PLACES,
  THERAPY_NUDGE_TRIGGERS,
} from '../analytics/therapy-nudge.constants';
import {
  formatTherapyNudge,
  TherapyNudgeMetrics,
} from './therapy-nudge-metrics.format';

function metrics(over: Partial<TherapyNudgeMetrics> = {}): TherapyNudgeMetrics {
  return {
    shownByPlace: THERAPY_NUDGE_PLACES.map((place) => ({ place, count: 0 })),
    signalByTrigger: THERAPY_NUDGE_TRIGGERS.map((trigger) => ({
      trigger,
      count: 0,
    })),
    open: 0,
    book: 0,
    write: 0,
    dismiss: 0,
    introFromApp: 0,
    ...over,
  };
}

describe('formatTherapyNudge', () => {
  it('пустая БД: честное «пока ничего», без нулей и мусора', () => {
    const out = formatTherapyNudge(metrics());
    expect(out).toBe('🌉 <b>Мост к терапевту</b> (за 30 дней)\nПока ничего.');
    expect(out).not.toMatch(/NaN|undefined|null|\b0\b/);
  });

  it('пустой список строк тоже не ломает отчёт', () => {
    const out = formatTherapyNudge(
      metrics({ shownByPlace: [], signalByTrigger: [] }),
    );
    expect(out).toContain('Пока ничего.');
  });

  it('показы по местам: только ненулевые, подписи словами, в порядке реестра', () => {
    const out = formatTherapyNudge(
      metrics({
        shownByPlace: THERAPY_NUDGE_PLACES.map((place) => ({
          place,
          count: place === 'home' ? 12 : place === 'diary_done' ? 3 : 0,
        })),
      }),
    );
    expect(out).toContain('Показали строку: на главной 12, после дневника 3.');
    expect(out).not.toContain('Пока ничего');
    expect(out).not.toContain('home');
  });

  it('карточка по сигналу: отдельная строка с разрезом по причинам', () => {
    const out = formatTherapyNudge(
      metrics({
        shownByPlace: THERAPY_NUDGE_PLACES.map((place) => ({
          place,
          count: place === 'signal_card' ? 5 : 0,
        })),
        signalByTrigger: [
          { trigger: 'low_index', count: 3 },
          { trigger: 'repeat_mode', count: 0 },
          { trigger: 'crisis', count: 1 },
          { trigger: 'none', count: 1 },
        ],
      }),
    );
    expect(out).toContain(
      'Показали карточку по сигналу: 5 (низкий индекс 3, кризис 1, без причины 1).',
    );
    expect(out).not.toContain('Показали строку');
  });

  it('карточка показана, а разреза нет: число без скобок', () => {
    const out = formatTherapyNudge(
      metrics({
        shownByPlace: THERAPY_NUDGE_PLACES.map((place) => ({
          place,
          count: place === 'signal_card' ? 2 : 0,
        })),
      }),
    );
    expect(out).toContain('Показали карточку по сигналу: 2.');
  });

  it('действия: открыли лист, перешли к записи, «написать», «не сейчас»', () => {
    const out = formatTherapyNudge(
      metrics({ open: 7, book: 3, write: 2, dismiss: 4 }),
    );
    expect(out).toContain(
      'Открыли лист 7, перешли к записи 3, нажали «написать» 2, нажали «не сейчас» 4.',
    );
  });

  it('только часть действий: нулевые не показываются', () => {
    const out = formatTherapyNudge(metrics({ book: 1 }));
    expect(out).toContain('Перешли к записи 1.');
    expect(out).not.toContain('открыли лист');
  });

  it('заявки из приложения показываются, даже если событий ещё нет', () => {
    const out = formatTherapyNudge(metrics({ introFromApp: 2 }));
    expect(out).toContain('Заявок с формы знакомства из приложения: 2.');
    expect(out).not.toContain('Пока ничего');
  });
});
