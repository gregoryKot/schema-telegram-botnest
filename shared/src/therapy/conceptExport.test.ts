// Текст «Экспорт концепта» — один билдер на оба фронтенда (QA 2026-11: копий
// было две, подписи разошлись с формой, «Переключение режимов» терялось, а
// пустой концепт молча не давал ничего). Блок «РЕЖИМЫ: СВЯЗИ» появляется,
// только когда на карте есть режим с заполненной связью, и стоит сразу после
// карты режимов.
import { describe, it, expect } from 'vitest';
import {
  buildConceptExport,
  isConceptEmpty,
  type ConceptExportInput,
} from './conceptExport';
import { CONCEPT_FIELDS } from './clientSheetHelpers';
import type { ClientConceptualizationBase } from './clientConceptualization';

type Concept = ClientConceptualizationBase;
const client = { telegramId: 7, name: 'Анна', clientAlias: null };

const concept = (patch: Partial<Concept> = {}): Concept => ({
  id: 1,
  therapistId: 1,
  clientId: 7,
  schemaIds: [],
  modeIds: [],
  earlyExperience: 'опыт',
  unmetNeeds: null,
  triggers: null,
  copingStyles: null,
  goals: null,
  currentProblems: null,
  modeTransitions: null,
  modeLinks: [],
  schemaLinks: [],
  history: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});

const exportOf = (
  c: Concept | null,
  local: Partial<Concept> = {},
  extra: Partial<ConceptExportInput> = {},
) =>
  buildConceptExport({
    client,
    concept: c,
    localConcept: local,
    activeSchemaIds: local.schemaIds ?? c?.schemaIds ?? [],
    activeModeIds: local.modeIds ?? c?.modeIds ?? [],
    ...extra,
  });

const EMPTY_FIELDS = {
  earlyExperience: null,
  unmetNeeds: null,
  triggers: null,
  copingStyles: null,
  goals: null,
  currentProblems: null,
  modeTransitions: null,
};

describe('buildConceptExport: поля — те же, что в форме', () => {
  it('каждое поле CONCEPT_FIELDS идёт своей подписью формы, по порядку формы', () => {
    const filled = Object.fromEntries(
      CONCEPT_FIELDS.map((f) => [f.key, `текст ${f.key}`]),
    );
    const text = exportOf(concept(filled));
    const at = CONCEPT_FIELDS.map((f) => {
      const i = text.indexOf(`${f.label.toUpperCase()}\nтекст ${f.key}\n`);
      expect(i, f.label).toBeGreaterThan(-1);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('«Стили совладания» и «Переключение режимов» — как в интерфейсе', () => {
    const text = exportOf(
      concept({
        copingStyles: 'избегание',
        modeTransitions: 'Критик → Ребёнок',
      }),
    );
    expect(text).toContain('СТИЛИ СОВЛАДАНИЯ\nизбегание');
    expect(text).toContain('ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ\nКритик → Ребёнок');
    expect(text).not.toContain('ДЕЗАДАПТИВНЫЕ КОПИНГИ');
  });

  it('пустое поле — прочерк, а не выдуманный текст', () => {
    expect(exportOf(concept())).toContain('СХЕМНЫЕ ТРИГГЕРЫ\n—\n');
  });

  it('шапка: имя терапевта только когда передано (мини-апп), алиас важнее имени', () => {
    expect(exportOf(concept()).split('\n')[0]).toMatch(
      /^Клиент: Анна {3}Дата: /,
    );
    const text = exportOf(
      concept(),
      {},
      {
        therapistName: 'Ольга',
        client: { telegramId: 7, name: 'Анна', clientAlias: 'А. К.' },
      },
    );
    expect(text.split('\n')[0]).toMatch(
      /^Терапевт: Ольга {3}Клиент: А\. К\. {3}Дата: /,
    );
  });
});

describe('buildConceptExport: пустой концепт', () => {
  it('нет концептуализации и правок — пустая строка, isConceptEmpty', () => {
    expect(exportOf(null)).toBe('');
    expect(isConceptEmpty({}, [], [])).toBe(true);
  });

  it('сохранённая, но пустая (поля из пробелов) — тоже пусто', () => {
    const c = concept({ ...EMPTY_FIELDS, goals: '   ' });
    expect(exportOf(c)).toBe('');
    expect(isConceptEmpty(c, [], [])).toBe(true);
  });

  it('одна схема, режим или поле — уже не пусто', () => {
    expect(isConceptEmpty({}, ['failure'], [])).toBe(false);
    expect(isConceptEmpty({}, [], ['punitive_critic'])).toBe(false);
    expect(isConceptEmpty({ modeTransitions: 'x' }, [], [])).toBe(false);
  });

  it('несохранённая правка без ответа сервера — экспорт есть', () => {
    expect(exportOf(null, { goals: 'черновик цели' })).toContain(
      'ЦЕЛИ СХЕМА-ТЕРАПИИ\nчерновик цели',
    );
  });

  it('нет клиента — пустая строка', () => {
    expect(exportOf(concept(), {}, { client: null })).toBe('');
  });
});

describe('buildConceptExport: связи режимов', () => {
  it('нет связей — блока нет', () => {
    const text = exportOf(concept({ modeIds: ['punitive_critic'] }));
    expect(text).toContain('КАРТА РЕЖИМОВ');
    expect(text).not.toContain('РЕЖИМЫ: СВЯЗИ');
  });

  it('есть связь — блок идёт сразу после карты режимов, с именем клиента', () => {
    const link = {
      modeId: 'punitive_critic',
      alias: 'Судья',
      schemaIds: ['failure'],
      needIds: ['limits'],
      origin: 'строгий отец',
      manifest: '',
      strategy: 'спорить с голосом',
    };
    const text = exportOf(
      concept({ modeIds: ['punitive_critic'], modeLinks: [link] }),
    );
    expect(text.indexOf('КАРТА РЕЖИМОВ')).toBeLessThan(
      text.indexOf('РЕЖИМЫ: СВЯЗИ'),
    );
    expect(text.indexOf('РЕЖИМЫ: СВЯЗИ')).toBeLessThan(
      text.indexOf('РАННИЙ ДИСФУНКЦИОНАЛЬНЫЙ ОПЫТ'),
    );
    expect(text).toContain('Карающий Критик («Судья»)');
    expect(text).toContain('  Схемы: Неуспешность');
    // потребности обычного режима в редакторе не правятся — в экспорт не идут
    expect(text).not.toContain('Потребности: Границы');
    expect(text).toContain('  В терапии: спорить с голосом');
    expect(text).not.toContain('Как проявляется');
  });

  it('несохранённая правка (localConcept) важнее ответа сервера', () => {
    const text = exportOf(concept({ modeIds: ['punitive_critic'] }), {
      modeLinks: [
        {
          modeId: 'punitive_critic',
          alias: 'Черновик',
          schemaIds: [],
          needIds: [],
          origin: '',
          manifest: '',
          strategy: '',
        },
      ],
    });
    expect(text).toContain('Карающий Критик («Черновик»)');
  });
});

describe('buildConceptExport: тексты схем', () => {
  const failure = {
    schemaId: 'failure',
    belief: 'Я хуже других',
    origin: 'строгий отец',
    needIds: ['autonomy'],
  };

  it('нет текстов — блока нет', () => {
    const text = exportOf(concept({ schemaIds: ['failure'] }));
    expect(text).not.toContain('СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ');
  });

  it('есть тексты отмеченной схемы — блок идёт после карты режимов и до раннего опыта', () => {
    const text = exportOf(
      concept({ schemaIds: ['failure'], schemaLinks: [failure] }),
    );
    expect(text.indexOf('КАРТА РЕЖИМОВ')).toBeLessThan(
      text.indexOf('СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ'),
    );
    expect(text.indexOf('СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ')).toBeLessThan(
      text.indexOf('РАННИЙ ДИСФУНКЦИОНАЛЬНЫЙ ОПЫТ'),
    );
    expect(text).toContain('  Убеждение: Я хуже других');
    expect(text).toContain('  Как нарушалась потребность: строгий отец');
    expect(text).toContain('  Блокирует потребности: Автономия');
  });

  it('несохранённая правка (localConcept) важнее ответа сервера', () => {
    const text = exportOf(concept({ schemaIds: ['failure'] }), {
      schemaLinks: [{ ...failure, belief: 'Черновик убеждения' }],
    });
    expect(text).toContain('  Убеждение: Черновик убеждения');
  });
});
