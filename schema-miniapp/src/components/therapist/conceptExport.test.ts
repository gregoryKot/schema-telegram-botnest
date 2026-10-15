// Текст экспорта концептуализации (мини-апп): блок «РЕЖИМЫ: СВЯЗИ» появляется
// только когда на карте есть режим с заполненной связью, и стоит сразу после
// карты режимов — как в экспорте сайта.
import { describe, it, expect } from 'vitest';
import { buildConceptExport } from './conceptExport';
import type { ClientConceptualization, TherapyClientSummary } from '../../api';

const client = {
  telegramId: 7,
  name: 'Анна',
  clientAlias: null,
} as TherapyClientSummary;

const concept = (
  patch: Partial<ClientConceptualization> = {},
): ClientConceptualization => ({
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
  history: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});

const exportOf = (
  c: ClientConceptualization,
  local: Partial<ClientConceptualization> = {},
) =>
  buildConceptExport({
    selectedClient: client,
    concept: c,
    localConcept: local,
    activeSchemaIds: c.schemaIds,
    activeModeIds: local.modeIds ?? c.modeIds,
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
    expect(text).toContain('  Потребности: Границы');
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
