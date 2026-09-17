// Тест practiceShareText и др. — часть shareTexts.ts не имела прямого теста
// в shared (остальные покрыты через schema-miniapp/src/share/shareTexts.test.ts,
// зеркалящий эти же чистые функции — см. cardKit.test.ts про тот же принцип
// раздельных прямых тестов). Собранные здесь функции ни разу не вызывались ни
// в одном тесте shared (значились 0% строк) — journeyShareText/journeyItemShareText
// сюда не входят: их прогоняет journeyShare.test.ts через buildJourneySharePayload.
import { describe, it, expect } from 'vitest';
import {
  practiceShareText,
  modeEntryFullShareText,
  pluralEntries,
  achievementShareText,
  streakShareText,
  schemaShareText,
  diaryShareText,
  modeShareText,
  monthShareText,
  achievementsShareText,
  phraseShareText,
  gratitudeShareText,
} from './shareTexts';

describe('practiceShareText', () => {
  it('со счётчиком: заголовок и счётчик в тексте', () => {
    const text = practiceShareText('Дыхание 4-4-6', 'прошли 7 раз');
    expect(text).toContain('Дыхание 4-4-6');
    expect(text).toContain('прошли 7 раз');
  });

  it('без счётчика (null): без хвоста-счётчика, без падения', () => {
    const text = practiceShareText('Техника «Стоп»', null);
    expect(text).toContain('Техника «Стоп»');
    expect(text).not.toContain('null');
  });

  it('со ссылкой: ссылка попадает в текст', () => {
    const text = practiceShareText(
      'Заземление 5-4-3-2-1',
      null,
      't.me/TestBot',
    );
    expect(text).toContain('t.me/TestBot');
  });

  it('без ссылки: текст короткий, без пустого хвоста', () => {
    const text = practiceShareText('Дыхание 4-4-6', null);
    expect(text.trim().endsWith('.')).toBe(true);
  });
});

describe('modeEntryFullShareText', () => {
  it('без текста записи в сообщении (текст на картинке), ссылка на месте', () => {
    const text = modeEntryFullShareText('t.me/TestBot');
    expect(text).toContain('🌿');
    expect(text).toContain('t.me/TestBot');
  });
});

describe('pluralEntries', () => {
  it('1, 21, 101 — «запись» (но не 11)', () => {
    expect(pluralEntries(1)).toBe('запись');
    expect(pluralEntries(21)).toBe('запись');
    expect(pluralEntries(101)).toBe('запись');
  });

  it('2-4, 22-24 — «записи» (но не 12-14)', () => {
    expect(pluralEntries(2)).toBe('записи');
    expect(pluralEntries(3)).toBe('записи');
    expect(pluralEntries(4)).toBe('записи');
    expect(pluralEntries(22)).toBe('записи');
  });

  it('11-14, 5-20, 0 — «записей»', () => {
    expect(pluralEntries(11)).toBe('записей');
    expect(pluralEntries(12)).toBe('записей');
    expect(pluralEntries(13)).toBe('записей');
    expect(pluralEntries(14)).toBe('записей');
    expect(pluralEntries(5)).toBe('записей');
    expect(pluralEntries(0)).toBe('записей');
  });
});

describe('achievementShareText', () => {
  it('название достижения и ссылка попадают в текст, форма нейтральная (1-е лицо)', () => {
    const text = achievementShareText('Неделя подряд', 't.me/TestBot');
    expect(text).toBe(
      'Новое достижение — «Неделя подряд»!\n\nВеду дневник потребностей. t.me/TestBot',
    );
  });
});

describe('streakShareText', () => {
  it('склоняет «день/дня/дней» по числу и подставляет ссылку', () => {
    expect(streakShareText(1, 't.me/TestBot')).toBe(
      '🔥 1 день подряд в дневнике потребностей!\n\nОтслеживаю своё состояние каждый день. t.me/TestBot',
    );
    expect(streakShareText(3, 't.me/TestBot')).toContain('3 дня подряд');
    expect(streakShareText(7, 't.me/TestBot')).toContain('7 дней подряд');
  });
});

describe('schemaShareText', () => {
  it('название схемы в кавычках-ёлочках, ссылка в конце', () => {
    const text = schemaShareText('Покорность', 't.me/TestBot');
    expect(text).toBe(
      '📖 Изучаю схему «Покорность» в схема-терапии.\n\nt.me/TestBot',
    );
  });
});

describe('diaryShareText', () => {
  it('с датой начала (since) — добавляет « с …» перед точкой', () => {
    const text = diaryShareText(
      'Дневник благодарности',
      '🌱',
      12,
      '1 июля',
      't.me/TestBot',
    );
    expect(text).toBe(
      '🌱 Дневник благодарности: 12 записей с 1 июля.\n\nt.me/TestBot',
    );
  });

  it('без даты начала (since=null) — без «с …», без «null» в тексте', () => {
    const text = diaryShareText('Дневник схем', '📖', 1, null, 't.me/TestBot');
    expect(text).toBe('📖 Дневник схем: 1 запись.\n\nt.me/TestBot');
    expect(text).not.toContain('null');
  });
});

describe('modeShareText', () => {
  it('название режима в кавычках-ёлочках, ссылка в конце', () => {
    const text = modeShareText('Уязвимый Ребёнок', 't.me/TestBot');
    expect(text).toBe(
      '🎭 Изучаю режим «Уязвимый Ребёнок» в схема-терапии.\n\nt.me/TestBot',
    );
  });
});

describe('monthShareText', () => {
  it('склоняет «день/дня/дней» по числу активных дней', () => {
    expect(monthShareText(1, 't.me/TestBot')).toContain('1 день с записями');
    expect(monthShareText(20, 't.me/TestBot')).toContain('20 дней с записями');
  });
});

describe('achievementsShareText', () => {
  it('счёт «получено из всего», ссылка на месте', () => {
    const text = achievementsShareText(5, 12, 't.me/TestBot');
    expect(text).toBe(
      '🏅 Достижения в дневнике потребностей: 5 из 12.\n\nt.me/TestBot',
    );
  });
});

describe('phraseShareText', () => {
  it('сама фраза в кавычках-ёлочках, подпись и ссылка следом', () => {
    const text = phraseShareText('Я справлюсь', 't.me/TestBot');
    expect(text).toBe(
      '«Я справлюсь»\n\nФраза Здорового взрослого · t.me/TestBot',
    );
  });
});

describe('gratitudeShareText', () => {
  it('без текста самой записи (он на картинке) — только ссылка', () => {
    const text = gratitudeShareText('t.me/TestBot');
    expect(text).toBe('🌱 Моя благодарность сегодня.\n\nt.me/TestBot');
  });
});
