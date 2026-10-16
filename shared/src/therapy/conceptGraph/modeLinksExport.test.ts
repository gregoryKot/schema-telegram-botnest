import { describe, it, expect } from 'vitest';
import { formatModeLinksExport } from './modeLinksExport';
import { emptyModeLink } from './modeLinks';

describe('formatModeLinksExport', () => {
  it('нет режимов на карте — пустая строка', () => {
    expect(formatModeLinksExport([], [])).toBe('');
    expect(
      formatModeLinksExport([], [{ ...emptyModeLink('m'), alias: 'х' }]),
    ).toBe('');
  });

  it('режимы на карте без заполненных связей — пустая строка', () => {
    expect(formatModeLinksExport(['vulnerable_child'], [])).toBe('');
    expect(
      formatModeLinksExport(
        ['vulnerable_child'],
        [{ ...emptyModeLink('vulnerable_child'), alias: '  ' }],
      ),
    ).toBe('');
  });

  it('связь режима, снятого с карты, в экспорт не попадает', () => {
    expect(
      formatModeLinksExport(
        ['vulnerable_child'],
        [{ ...emptyModeLink('punitive_critic'), alias: 'Судья' }],
      ),
    ).toBe('');
  });

  it('блок по образцу: заголовок, имя клиента, строки связи; пустые строки не печатаются', () => {
    const out = formatModeLinksExport(
      ['punitive_critic', 'vulnerable_child'],
      [
        {
          modeId: 'vulnerable_child',
          alias: 'Маленькая Аня',
          schemaIds: ['failure', 'abandonment'],
          needIds: ['attachment'],
          origin: 'мама уезжала',
          manifest: '',
          strategy: 'рескриптинг',
        },
        { ...emptyModeLink('punitive_critic'), manifest: 'ругает за ошибки' },
      ],
    );
    expect(out).toBe(
      [
        'РЕЖИМЫ: СВЯЗИ',
        'Уязвимый Ребёнок («Маленькая Аня»)',
        '  Схемы: Покинутость / Нестабильность · Неуспешность',
        '  Откуда: мама уезжала',
        '  В терапии: рескриптинг',
        'Карающий Критик',
        '  Что говорит: ругает за ошибки',
      ].join('\n'),
    );
  });

  it('многострочный текст сдвигается под метку', () => {
    const out = formatModeLinksExport(
      ['vulnerable_child'],
      [{ ...emptyModeLink('vulnerable_child'), origin: 'раз\nдва' }],
    );
    expect(out).toContain('  Откуда: раз\n    два');
  });

  it('подпись текста зависит от группы, потребности — только у здорового режима, схемы — только у остальных', () => {
    const out = formatModeLinksExport(
      ['vulnerable_child', 'detached_protector', 'healthy_adult'],
      [
        {
          ...emptyModeLink('vulnerable_child'),
          manifest: 'боится остаться без поддержки',
          needIds: ['limits'],
        },
        { ...emptyModeLink('detached_protector'), manifest: 'уходит в работу' },
        {
          ...emptyModeLink('healthy_adult'),
          manifest: 'Я имею право на поддержку',
          needIds: ['autonomy', 'play'],
          schemaIds: ['failure'],
        },
      ],
    );
    expect(out).toContain(
      '  Что чувствует и чего хочет: боится остаться без поддержки',
    );
    expect(out).toContain('  Что делает и как это выглядит: уходит в работу');
    expect(out).toContain(
      '  Заботится о потребностях: Автономия · Спонтанность',
    );
    expect(out).toContain('  На что опирается: Я имею право на поддержку');
    // потребности обычного режима и схемы здорового в экспорт не идут: в редакторе их нет
    expect(out).not.toContain('Границы');
    expect(out).not.toContain('Неуспешность');
    expect(out).not.toContain('Как проявляется');
  });
});
