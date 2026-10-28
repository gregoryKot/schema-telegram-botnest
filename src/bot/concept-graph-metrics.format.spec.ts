import { formatConceptGraphMetrics } from './concept-graph-metrics.format';
import type { ConceptGraphMetrics } from './concept-graph-metrics.types';

// Все счётчики по нулю: каждый кейс задаёт только нужные поля, остальные —
// из базы, чтобы новое поле в типе (saveRetry30, #879) не ломало литералы.
const base: ConceptGraphMetrics = {
  opens30: 0,
  therapists30: 0,
  linked30: 0,
  schemaLinked30: 0,
  canvasOpen30: 0,
  fullscreen30: 0,
  saveRetry30: 0,
};

describe('formatConceptGraphMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatConceptGraphMetrics({ ...base });
    expect(text).toContain('🧩 <b>Графическая концептуализация</b> (за месяц)');
    expect(text).toContain(
      'Пока никто из терапевтов не открывал схему случая по режимам.',
    );
    expect(text).not.toMatch(/NaN|undefined|null|\b0\b/);
    expect(text).not.toContain('Повторяли сохранение');
  });

  it('заполненная БД — открытия, терапевты и заполненные связи', () => {
    const text = formatConceptGraphMetrics({
      ...base,
      opens30: 14,
      therapists30: 3,
      linked30: 9,
      schemaLinked30: 6,
      canvasOpen30: 2,
      fullscreen30: 8,
    });
    expect(text).toContain('Открывали 14 раз, терапевтов: 3');
    expect(text).toContain('Связи режимов заполняли 9 раз');
    expect(text).toContain('Убеждения и опыт схем записывали 6 раз');
    expect(text).toContain('Переносили схему случая на холст 2 раз');
    expect(text).toContain('Разворачивали схему на весь экран 8 раз');
    expect(text).not.toContain('Пока никто');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('открывали, но связи не заполняли — это сказано словами, без «0 раз»', () => {
    const text = formatConceptGraphMetrics({
      ...base,
      opens30: 5,
      therapists30: 2,
    });
    expect(text).toContain('Открывали 5 раз, терапевтов: 2');
    expect(text).toContain('Связи режимов пока не заполняли');
    expect(text).not.toContain('заполняли 0');
    // Нет текстов схем — строки про них нет совсем, а не «записывали 0 раз».
    expect(text).not.toContain('Убеждения и опыт схем');
    // Так же с холстом: нет переносов — нет строки, а не «переносили 0 раз».
    expect(text).not.toContain('холст');
    // И с полным экраном: не разворачивали — строки нет, а не «разворачивали 0 раз».
    expect(text).not.toContain('весь экран');
  });

  it('связи заполняли, а открытий в окне нет — блок не пустой и не теряет связи', () => {
    const text = formatConceptGraphMetrics({ ...base, linked30: 2 });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Связи режимов заполняли 2 раз');
  });

  it('только тексты схем: блок не пустой, строка про схемы стоит, мусора нет', () => {
    const text = formatConceptGraphMetrics({ ...base, schemaLinked30: 4 });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Убеждения и опыт схем записывали 4 раз');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('пустая БД не упоминает схемы: только строка «Пока никто»', () => {
    const text = formatConceptGraphMetrics({ ...base });
    expect(text).not.toContain('Убеждения и опыт схем');
  });

  it('только перенос на холст: блок не пустой, строка про холст стоит, мусора нет', () => {
    const text = formatConceptGraphMetrics({ ...base, canvasOpen30: 5 });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Переносили схему случая на холст 5 раз');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('пустая БД не упоминает холст', () => {
    const text = formatConceptGraphMetrics({ ...base });
    expect(text).not.toContain('холст');
  });

  it('только разворот на весь экран: блок не пустой, строка про него стоит, мусора нет', () => {
    const text = formatConceptGraphMetrics({ ...base, fullscreen30: 3 });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Разворачивали схему на весь экран 3 раз');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('пустая БД не упоминает полный экран', () => {
    const text = formatConceptGraphMetrics({ ...base });
    expect(text).not.toContain('весь экран');
  });

  it('только повторы сохранения (#879): блок не пустой, строка про повторы стоит, мусора нет', () => {
    const text = formatConceptGraphMetrics({ ...base, saveRetry30: 2 });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Повторяли сохранение после ошибки 2 раз');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });
});
