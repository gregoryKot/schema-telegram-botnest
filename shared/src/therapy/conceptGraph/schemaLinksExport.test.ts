import { describe, it, expect } from 'vitest';
import { emptyModeLink } from './modeLinks';
import { emptySchemaLink } from './schemaLinks';
import { formatSchemaLinksExport } from './schemaLinksExport';
import { formatConceptLinksExport } from './conceptLinksExport';

const deprivation = {
  schemaId: 'emotional_deprivation',
  belief: 'Я верю, что мои переживания не имеют смысла',
  origin: 'Был вынужден поддерживать маму после ухода папы',
  needIds: ['expression', 'attachment'],
};

describe('formatSchemaLinksExport', () => {
  it('нет отмеченных схем или нет текстов — пустая строка', () => {
    expect(formatSchemaLinksExport([], [], [], [])).toBe('');
    expect(formatSchemaLinksExport(['emotional_deprivation'], [], [], [])).toBe(
      '',
    );
    expect(
      formatSchemaLinksExport(
        ['emotional_deprivation'],
        [],
        [],
        [{ ...emptySchemaLink('emotional_deprivation'), belief: '  ' }],
      ),
    ).toBe('');
  });

  it('блок по образцу: заголовок, схема, строки полей; потребности — в порядке реестра, пустые строки не печатаются', () => {
    const out = formatSchemaLinksExport(
      ['emotional_deprivation', 'failure'],
      [],
      [],
      [deprivation, { ...emptySchemaLink('failure'), belief: 'Я хуже других' }],
    );
    expect(out).toBe(
      [
        'СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ',
        'Эмоциональная депривация',
        '  Убеждение: Я верю, что мои переживания не имеют смысла',
        '  Как нарушалась потребность: Был вынужден поддерживать маму после ухода папы',
        '  Блокирует потребности: Привязанность · Выражение чувств',
        'Неуспешность',
        '  Убеждение: Я хуже других',
      ].join('\n'),
    );
  });

  it('тексты схемы, снятой из концептуализации, в экспорт не идут; схема из связи режима — идёт', () => {
    expect(formatSchemaLinksExport(['failure'], [], [], [deprivation])).toBe(
      '',
    );
    const viaMode = formatSchemaLinksExport(
      [],
      ['guilt_critic'],
      [
        {
          ...emptyModeLink('guilt_critic'),
          schemaIds: ['emotional_deprivation'],
        },
      ],
      [deprivation],
    );
    expect(viaMode).toContain('Эмоциональная депривация');
  });

  it('многострочное убеждение: продолжение сдвигается под метку', () => {
    const out = formatSchemaLinksExport(
      ['failure'],
      [],
      [],
      [{ ...emptySchemaLink('failure'), belief: 'раз\nдва' }],
    );
    expect(out).toContain('  Убеждение: раз\n    два');
  });
});

describe('formatConceptLinksExport', () => {
  it('пусто и режимы, и схемы — пустая строка', () => {
    expect(formatConceptLinksExport([], [], {})).toBe('');
  });

  it('схемы идут перед режимами, блоки через пустую строку; только схемы — без хвоста', () => {
    const modeLinks = [{ ...emptyModeLink('guilt_critic'), alias: 'Совесть' }];
    const both = formatConceptLinksExport(
      ['emotional_deprivation'],
      ['guilt_critic'],
      {
        modeLinks,
        schemaLinks: [deprivation],
      },
    );
    const parts = both.split('\n\n');
    expect(parts).toHaveLength(2);
    expect(parts[0].startsWith('СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ')).toBe(true);
    expect(parts[1].startsWith('РЕЖИМЫ: СВЯЗИ')).toBe(true);

    const onlySchemas = formatConceptLinksExport(
      ['emotional_deprivation'],
      [],
      {
        schemaLinks: [deprivation],
      },
    );
    expect(onlySchemas.startsWith('СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ')).toBe(true);
    expect(onlySchemas).not.toContain('РЕЖИМЫ');
  });
});
