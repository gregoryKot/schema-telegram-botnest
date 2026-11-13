// Шаблоны notification.templates*.ts: reminder-payload, донат, годовщины,
// практики, Помощь, задание, пара, YSQ. Данных о состоянии и текстов
// пользователя в шаблонах нет (РКН, #1135) — общий гейт: notification.no-state-data.spec.ts.
import { renderTemplate } from './notification.templates';

describe('renderTemplate — reminder: строки, зависящие от payload', () => {
  it('старый payload (yesterdayAvg, lowestNeed) не читается — текст без оценок и потребностей', () => {
    const result = renderTemplate('reminder', {
      yesterdayAvg: 6.5,
      lowestNeed: 'Автономия',
      lowestNeedId: 'autonomy',
      variant: 0,
    })!;
    expect(result.text).not.toMatch(/Вчера индекс|6\.5|Автономия|Попробуй/);
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
      'открываешь историю',
    );
    expect(renderTemplate('anniversary_60', undefined, 'vy')!.text).toContain(
      'открываете историю',
    );
  });

  it('anniversary_90 — нейтральный текст (без формы)', () => {
    expect(renderTemplate('anniversary_90')!.text).toContain('Три месяца');
  });
});

describe('renderTemplate — practice_reminder / practice_missed', () => {
  const callbacks = (r: any): string[] =>
    r.keyboard.reply_markup.inline_keyboard
      .flat()
      .map((b: any) => b.callback_data)
      .filter(Boolean);

  it('practice_reminder: постоянный текст, без plan_done и текста плана из старого payload', () => {
    const result = renderTemplate('practice_reminder', {
      practiceText: 'подышать 5 минут',
      planId: 42,
    })!;
    expect(result.text).not.toContain('подышать');
    expect(callbacks(result)).toEqual([]);
  });

  it('practice_missed: день недели — из таблицы по индексу, без индекса — «Вчера»', () => {
    const named = renderTemplate('practice_missed', { weekday: 5 })!;
    expect(named.text).toContain('План на пятницу');
    const yesterday = renderTemplate('practice_missed', {})!;
    expect(yesterday.text).toContain('Вчера был план');
    expect(yesterday.text).toContain('как получилось?');
    expect(callbacks(yesterday)).toEqual([]);
  });

  it('practice_missed: строка в weekday и текст плана из старого payload не рендерятся', () => {
    const result = renderTemplate('practice_missed', {
      weekday: 'на пятницу',
      day: 'на пятницу',
      practiceText: 'написать письмо',
      planId: 7,
    })!;
    expect(result.text).not.toContain('письмо');
    expect(result.text).toContain('Вчера был план');
  });
});

describe('renderTemplate — low_streak_insight', () => {
  it('постоянный текст в обеих формах, кнопки «Помощь» и запись всегда', () => {
    const ty = renderTemplate('low_streak_insight', {}, 'ty')!;
    const vy = renderTemplate('low_streak_insight', {}, 'vy')!;
    expect(ty.text).toContain('Загляни');
    expect(vy.text).toContain('Загляните');
    expect((ty.keyboard as any).reply_markup.inline_keyboard.length).toBe(2);
  });

  it('старый payload (text про потребность, showBooking) не читается', () => {
    const result = renderTemplate('low_streak_insight', {
      text: 'Автономия уже 10 дней невысокая',
      showBooking: false,
    })!;
    expect(result.text).not.toContain('Автономия');
    expect((result.keyboard as any).reply_markup.inline_keyboard.length).toBe(
      2,
    );
  });
});

describe('renderTemplate — task_assigned', () => {
  it('без payload — постоянный текст про приложение, кнопка на раздел заданий', () => {
    const result = renderTemplate('task_assigned', {})!;
    expect(result.text).toContain('в приложении');
    expect(JSON.stringify(result.keyboard)).toContain('startapp=tasks"');
  });

  it('старый payload (text, needId, dueDate) не читается, taskId — в ссылку', () => {
    const result = renderTemplate('task_assigned', {
      text: 'Понаблюдай за собой',
      needId: 'autonomy',
      dueDate: '2026-07-20',
      taskId: 9,
    })!;
    expect(result.text).not.toMatch(/Понаблюдай|Автономия|июля|Срок/);
    expect(JSON.stringify(result.keyboard)).toContain('startapp=tasks_9');
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

  it('ysq_requested без имени терапевта — форма "ты"', () => {
    const result = renderTemplate('ysq_requested', {}, 'ty')!;
    expect(result.text).toContain('Твой терапевт просит тебя');
    expect(result.text).toContain('твои схемы');
  });

  it('ysq_requested без имени терапевта — форма "вы"', () => {
    const result = renderTemplate('ysq_requested', {}, 'vy')!;
    expect(result.text).toContain('Ваш терапевт просит вас');
    expect(result.text).toContain('ваши схемы');
  });
});
