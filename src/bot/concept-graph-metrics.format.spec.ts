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
  brief30: 0,
  syncToMap30: 0,
  syncFromMap30: 0,
  guideModes30: 0,
  guideSchemas30: 0,
  guideTechniques30: 0,
  guideAssign30: 0,
  guideMarkDone30: 0,
  sharedNow: 0,
  shareOn30: 0,
  shareOff30: 0,
  clientOpens30: 0,
  clientOpeners30: 0,
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
    expect(text).toContain('Собирали карту из концептуализации 2 раз');
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
    expect(text).toContain('Собирали карту из концептуализации 5 раз');
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

  it('только «Главное» (2026-11): блок не пустой, строка про экран стоит, мусора нет', () => {
    const text = formatConceptGraphMetrics({ ...base, brief30: 7 });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Открывали «Главное» на одном экране 7 раз');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('пустая БД не упоминает «Главное»', () => {
    expect(formatConceptGraphMetrics({ ...base })).not.toContain('Главное');
  });

  it('только повторы сохранения (#879): блок не пустой, строка про повторы стоит, мусора нет', () => {
    const text = formatConceptGraphMetrics({ ...base, saveRetry30: 2 });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Повторяли сохранение после ошибки 2 раз');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('связь холста с полями (#963): обе строки, только когда было', () => {
    const text = formatConceptGraphMetrics({
      ...base,
      syncToMap30: 3,
      syncFromMap30: 12,
    });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Дописывали на карту из полей: 3 раз');
    expect(text).toContain('Холст дописывал в концептуализацию: 12 раз');
    const onlyFrom = formatConceptGraphMetrics({ ...base, syncFromMap30: 1 });
    expect(onlyFrom).toContain('Холст дописывал в концептуализацию: 1 раз');
    expect(onlyFrom).not.toContain('Дописывали на карту');
    expect(onlyFrom).not.toMatch(/NaN|undefined|null|полей: 0/);
  });

  it('показ схемы клиенту: строки только о том, что было, — без «0 раз»', () => {
    const text = formatConceptGraphMetrics({
      ...base,
      sharedNow: 2,
      shareOn30: 3,
      clientOpens30: 5,
      clientOpeners30: 2,
    });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Схему случая сейчас видят клиенты: 2');
    expect(text).toContain('Терапевты включали показ схемы клиенту: 3 раз');
    expect(text).toContain('Клиенты смотрели свою схему 5 раз, клиентов: 2');
    expect(text).not.toContain('Выключали');
    expect(text).not.toMatch(/NaN|undefined|null/);
    // Только выключение — строка про него есть, про остальное нет.
    const off = formatConceptGraphMetrics({ ...base, shareOff30: 1 });
    expect(off).toContain('Выключали показ: 1 раз');
    expect(off).not.toContain('видят клиенты');
  });

  it('пустая БД не упоминает показ клиенту', () => {
    const text = formatConceptGraphMetrics({ ...base });
    expect(text).not.toContain('показ');
    expect(text).not.toContain('Клиенты смотрели');
  });

  it('пустая БД не упоминает дописывание', () => {
    expect(formatConceptGraphMetrics({ ...base })).not.toContain('Дописано');
  });

  it('подсказки терапевту (#995): листы и «Дать заданием» одной строкой', () => {
    const text = formatConceptGraphMetrics({
      ...base,
      opens30: 4,
      therapists30: 1,
      guideModes30: 6,
      guideSchemas30: 5,
      guideTechniques30: 9,
      guideAssign30: 2,
    });
    expect(text).toContain(
      'Подсказки терапевту — листы режимов: 6, листы схем: 5, листы техник: 9, «Дать заданием»: 2',
    );
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('подсказки: нулевые части не печатаются, «: 0» в строке нет', () => {
    const text = formatConceptGraphMetrics({ ...base, guideAssign30: 3 });
    expect(text).toContain('Подсказки терапевту — «Дать заданием»: 3');
    expect(text).not.toContain('листы');
    expect(text).not.toMatch(/(режимов|схем|техник|заданием»): 0/);
  });

  it('подсказки: только листы схем — строка про них, без режимов и техник', () => {
    const text = formatConceptGraphMetrics({ ...base, guideSchemas30: 4 });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Подсказки терапевту — листы схем: 4');
    expect(text).not.toMatch(/листы (режимов|техник)|NaN|undefined|null/);
  });

  it('подсказки: «Делали сегодня» — «отметили техник: N», ноль не печатается', () => {
    const text = formatConceptGraphMetrics({
      ...base,
      guideTechniques30: 7,
      guideMarkDone30: 3,
    });
    expect(text).toContain(
      'Подсказки терапевту — листы техник: 7, отметили техник: 3',
    );
    const none = formatConceptGraphMetrics({ ...base, guideTechniques30: 7 });
    expect(none).not.toContain('отметили');
  });

  it('схемой пользовались, а подсказки не открывали — сказано словами', () => {
    const text = formatConceptGraphMetrics({
      ...base,
      opens30: 5,
      therapists30: 2,
    });
    expect(text).toContain('Подсказки терапевту пока не открывали');
  });

  it('пустая БД не упоминает подсказки, листы схем и отметки техник', () => {
    const text = formatConceptGraphMetrics({ ...base });
    expect(text).not.toContain('Подсказки');
    expect(text).not.toContain('листы схем');
    expect(text).not.toContain('отметили');
  });
});
