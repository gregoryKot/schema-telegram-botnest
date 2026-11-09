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
    session: 0,
    introFromApp: 0,
    bookingFromApp: 0,
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
    expect(out).toContain(
      'Показали строку: внизу главной или «Ещё» (прежняя метка) 12, после дневника 3.',
    );
    expect(out).not.toContain('Пока ничего');
    expect(out).not.toContain('home');
  });

  // Находка 2026-11-06: строка внизу «Ещё» шла с меткой home, и отчёт
  // приписывал её показы главной. Новое место — more_bottom.
  it('строка внизу «Ещё» подписана как «Ещё», а не главная', () => {
    const out = formatTherapyNudge(
      metrics({ shownByPlace: [{ place: 'more_bottom', count: 4 }] }),
    );
    expect(out).toContain('Показали строку: внизу «Ещё» 4.');
    expect(out).not.toContain('главн');
  });

  it('новые места: подписи попадают в текст, id не торчат', () => {
    const counts: Record<string, number> = {
      home_card: 7,
      practice: 6,
      diary: 5,
      exercise_start: 4,
      test_start: 3,
      why: 2,
    };
    const out = formatTherapyNudge(
      metrics({
        shownByPlace: THERAPY_NUDGE_PLACES.map((place) => ({
          place,
          count: counts[place] ?? 0,
        })),
      }),
    );
    expect(out).toContain(
      'карточкой на главной 7, в «Практиках» 6, в «Записях» 5, на входе в упражнение 4, на входе в тест 3, в листе «Зачем это всё» 2',
    );
    expect(out).not.toContain('exercise_start');
    expect(out).not.toContain('test_start');
    expect(out).not.toMatch(/\bwhy\b/);
  });

  // Место без подписи молча пропадает из отчёта (nonZero идёт по подписям):
  // каждое место реестра, кроме карточки по сигналу со своей строкой, подписано.
  it('у каждого места реестра есть подпись, кроме карточки по сигналу', () => {
    const lined = THERAPY_NUDGE_PLACES.filter((p) => p !== 'signal_card');
    const out = formatTherapyNudge(
      metrics({
        shownByPlace: THERAPY_NUDGE_PLACES.map((place) => ({
          place,
          count: place === 'signal_card' ? 0 : 1,
        })),
      }),
    );
    const line = out.split('\n').find((l) => l.startsWith('Показали строку: '));
    const parts = line!
      .replace('Показали строку: ', '')
      .replace(/\.$/, '')
      .split(', ');
    expect(parts).toHaveLength(lined.length);
    for (const place of lined) expect(out).not.toContain(place);
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

  // dismiss — и «Не сейчас» карточки по сигналу, и «Скрыть» постоянной карточки (2026-11-08).
  it('действия: открыли лист, перешли к записи, «написать», скрыли карточку', () => {
    const out = formatTherapyNudge(
      metrics({ open: 7, book: 3, write: 2, dismiss: 4 }),
    );
    expect(out).toContain(
      'Открыли лист 7, перешли к записи 3, нажали «написать» 2, скрыли карточку 4.',
    );
  });

  // U4: свой терапевт без канала — лист ведёт к ближайшей встрече.
  it('переход к встрече со своим терапевтом: число показывается, ноль нет', () => {
    expect(formatTherapyNudge(metrics({ session: 2 }))).toContain(
      'Перешли к встрече со своим терапевтом 2.',
    );
    expect(formatTherapyNudge(metrics())).not.toContain('встрече');
  });

  it('только часть действий: нулевые не показываются', () => {
    const out = formatTherapyNudge(metrics({ book: 1 }));
    expect(out).toContain('Перешли к записи 1.');
    expect(out).not.toContain('открыли лист');
  });

  it('записи на слот из приложения: число показывается, ноль нет', () => {
    const out = formatTherapyNudge(metrics({ bookingFromApp: 3 }));
    expect(out).toContain('Записей на слот из приложения: 3.');
    expect(out).not.toContain('Пока ничего');
    expect(formatTherapyNudge(metrics())).not.toContain('Записей на слот');
  });

  it('заявки из приложения показываются, даже если событий ещё нет', () => {
    const out = formatTherapyNudge(metrics({ introFromApp: 2 }));
    expect(out).toContain('Заявок с формы знакомства из приложения: 2.');
    expect(out).not.toContain('Пока ничего');
  });
});
