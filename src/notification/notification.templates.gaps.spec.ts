// Топ-ап покрытия notification.templates.ts (было 65%/52% — самый большой
// непокрытый блок 305-452: donate_reminder, anniversary_*, practice_reminder/
// missed, low_streak_insight, task_assigned, pair_activity, ysq_requested;
// плюс ветки reminder 194,197-198,200,212). notification.templates.spec.ts уже
// покрывает reminder-кнопки/стрик/лапсинг — здесь только пробелы, без дублей.
import {
  renderTemplate,
  renderLowStreakInsight,
} from './notification.templates';

describe('renderTemplate — reminder: строки, зависящие от payload', () => {
  it('yesterdayAvg добавляет строку "Вчера индекс был N.N"', () => {
    const result = renderTemplate('reminder', {
      yesterdayAvg: 6.5,
      variant: 0,
    })!;
    expect(result.text).toContain('Вчера индекс был 6.5.');
  });

  it('lowestNeed + lowestNeedId → подсказка с практикой ("Попробуй: ...")', () => {
    const result = renderTemplate('reminder', {
      lowestNeed: 'Автономия',
      lowestNeedId: 'autonomy',
      seed: 0,
      variant: 0,
    })!;
    expect(result.text).toContain('Автономия просит внимания.');
    expect(result.text).toMatch(/Попробуй:/);
  });

  it('только lowestNeed без lowestNeedId → короткая фраза без практики', () => {
    const result = renderTemplate('reminder', {
      lowestNeed: 'Автономия',
      variant: 0,
    })!;
    expect(result.text).toContain('Обрати внимание на Автономия.');
    expect(result.text).not.toMatch(/Попробуй:/);
  });

  it('gamified + approachingStreak → строка про веху', () => {
    const result = renderTemplate('reminder', {
      streak: 6,
      gamified: true,
      approachingStreak: 7,
      variant: 0,
    })!;
    expect(result.text).toContain('Ещё один день — и будет 7 дней подряд.');
  });

  it('gamified показывает серию уже с 1 дня (не только с 3)', () => {
    const result = renderTemplate('reminder', {
      streak: 1,
      gamified: true,
      variant: 0,
    })!;
    expect(result.text).toContain('🔥 Серия: 1 день подряд.');
  });

  it('onBreak=true скрывает "вчера" и подсказку по потребности', () => {
    const result = renderTemplate('reminder', {
      onBreak: true,
      yesterdayAvg: 6.5,
      lowestNeed: 'Автономия',
      lowestNeedId: 'autonomy',
      variant: 0,
    })!;
    expect(result.text).not.toContain('Вчера индекс был');
    expect(result.text).not.toContain('просит внимания');
  });
});

describe('renderTemplate — donate_reminder', () => {
  it('totalDays >= 30 — value-anchored формулировка со счётчиком дней', () => {
    const result = renderTemplate('donate_reminder', { totalDays: 45 }, 'ty')!;
    expect(result.text).toContain('Ты уже 45 дней наблюдаешь за собой');
    expect(result.keyboard).toBeDefined();
  });

  it('форма "вы" для давнего юзера', () => {
    const result = renderTemplate('donate_reminder', { totalDays: 30 }, 'vy')!;
    expect(result.text).toContain('Вы уже 30 дней наблюдаете за собой');
  });

  it('totalDays < 30 (или отсутствует) — ротация из DONATE_MESSAGES по seed', () => {
    const a = renderTemplate('donate_reminder', { totalDays: 5, seed: 0 })!;
    const b = renderTemplate('donate_reminder', { seed: 1 })!;
    expect(a.text).not.toContain('наблюдаешь за собой');
    expect(b.text).not.toContain('наблюдаешь за собой');
  });
});

describe('renderTemplate — anniversary_*', () => {
  it('anniversary_30 в обеих формах', () => {
    expect(renderTemplate('anniversary_30', undefined, 'ty')!.text).toContain(
      'Ты уже знаешь',
    );
    expect(renderTemplate('anniversary_30', undefined, 'vy')!.text).toContain(
      'Вы уже знаете',
    );
  });

  it('anniversary_60 в обеих формах', () => {
    expect(renderTemplate('anniversary_60', undefined, 'ty')!.text).toContain(
      'ты видишь себя в динамике',
    );
    expect(renderTemplate('anniversary_60', undefined, 'vy')!.text).toContain(
      'вы видите себя в динамике',
    );
  });

  it('anniversary_90 — нейтральный текст (без формы)', () => {
    expect(renderTemplate('anniversary_90')!.text).toContain('Три месяца');
  });
});

describe('renderTemplate — practice_reminder / practice_missed', () => {
  it('practice_reminder без practiceText → null', () => {
    expect(renderTemplate('practice_reminder', {})).toBeNull();
  });

  it('practice_reminder с planId — кнопки "Сделано"/"Не получилось"', () => {
    const result = renderTemplate('practice_reminder', {
      practiceText: 'подышать 5 минут',
      planId: 42,
    })!;
    const cbs = (result.keyboard as any).reply_markup.inline_keyboard
      .flat()
      .map((b: any) => b.callback_data)
      .filter(Boolean);
    expect(cbs).toEqual(['plan_done:42', 'plan_skip:42']);
    expect(result.text).toContain('подышать 5 минут');
  });

  it('practice_reminder без planId — только кнопка открыть дневник', () => {
    const result = renderTemplate('practice_reminder', {
      practiceText: 'подышать 5 минут',
    })!;
    const cbs = (result.keyboard as any).reply_markup.inline_keyboard
      .flat()
      .map((b: any) => b.callback_data)
      .filter(Boolean);
    expect(cbs).toEqual([]);
  });

  it('practice_missed без practiceText → null', () => {
    expect(renderTemplate('practice_missed', {})).toBeNull();
  });

  it('practice_missed с planId — кнопки "Всё-таки сделано"/"Не вышло"', () => {
    const result = renderTemplate('practice_missed', {
      practiceText: 'написать письмо',
      planId: 7,
    })!;
    const cbs = (result.keyboard as any).reply_markup.inline_keyboard
      .flat()
      .map((b: any) => b.callback_data)
      .filter(Boolean);
    expect(cbs).toEqual(['plan_done:7', 'plan_skip:7']);
    expect(result.text).toContain('Как получилось?');
  });
});

describe('renderTemplate — low_streak_insight', () => {
  it('без text → null', () => {
    expect(renderTemplate('low_streak_insight', {})).toBeNull();
  });

  it('showBooking=true — добавляет кнопку записи на сессию', () => {
    const result = renderTemplate('low_streak_insight', {
      text: 'Автономия невысокая уже 10 дней',
      showBooking: true,
    })!;
    const rows = (result.keyboard as any).reply_markup.inline_keyboard;
    expect(rows.length).toBe(2);
  });

  it('showBooking=false — только кнопка раздела Помощь', () => {
    const result = renderTemplate('low_streak_insight', {
      text: 'Автономия невысокая',
      showBooking: false,
    })!;
    const rows = (result.keyboard as any).reply_markup.inline_keyboard;
    expect(rows.length).toBe(1);
  });
});

describe('renderTemplate — task_assigned', () => {
  it('без text → null', () => {
    expect(renderTemplate('task_assigned', {})).toBeNull();
  });

  it('известный needId добавляет строку "Потребность: ..."', () => {
    const result = renderTemplate('task_assigned', {
      text: 'Понаблюдай за собой',
      needId: 'autonomy',
    })!;
    expect(result.text).toContain('Потребность: Автономия');
  });

  it('неизвестный needId — строка не добавляется', () => {
    const result = renderTemplate('task_assigned', {
      text: 'Понаблюдай за собой',
      needId: 'not_a_real_need',
    })!;
    expect(result.text).not.toContain('Потребность:');
  });

  it('dueDate добавляет строку "Срок: D Month" (timezone-safe, полдень UTC)', () => {
    const result = renderTemplate('task_assigned', {
      text: 'Задание',
      dueDate: '2026-07-20',
    })!;
    expect(result.text).toContain('Срок: 20 июля');
  });

  it('без needId/dueDate — только базовый текст', () => {
    const result = renderTemplate('task_assigned', { text: 'Задание' })!;
    expect(result.text).not.toContain('Потребность:');
    expect(result.text).not.toContain('Срок:');
  });
});

describe('renderTemplate — pair_activity / ysq_requested', () => {
  it('pair_activity — нейтральный текст без формы', () => {
    const result = renderTemplate('pair_activity')!;
    expect(result.text).toContain('Напарник сегодня уже отметил');
  });

  it('ysq_requested с именем терапевта', () => {
    const result = renderTemplate('ysq_requested', {
      therapistName: 'Иванова А.С.',
    })!;
    expect(result.text).toContain('Терапевт Иванова А.С. просит');
  });

  it('ysq_requested без имени терапевта — нейтральная формулировка', () => {
    const result = renderTemplate('ysq_requested', {})!;
    expect(result.text).toContain('Ваш терапевт просит');
  });
});

describe('renderLowStreakInsight', () => {
  it('daysBelowThreshold >= 10 — showBooking, кнопка записи на сессию', () => {
    const result = renderLowStreakInsight('⚖️', 'Границы', 12);
    const rows = (result.keyboard as any).reply_markup.inline_keyboard;
    expect(rows.length).toBe(2);
    expect(result.text).toContain('Это может быть паттерн');
  });

  it('daysBelowThreshold < 10 — без записи на сессию, форма "ты"/"вы"', () => {
    const ty = renderLowStreakInsight('⚖️', 'Границы', 5, 'ty');
    const vy = renderLowStreakInsight('⚖️', 'Границы', 5, 'vy');
    expect((ty.keyboard as any).reply_markup.inline_keyboard.length).toBe(1);
    expect(ty.text).toContain('попробуй');
    expect(vy.text).toContain('попробуйте');
  });
});
