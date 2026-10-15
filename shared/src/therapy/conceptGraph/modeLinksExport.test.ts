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
        '  Потребности: Привязанность',
        '  Откуда: мама уезжала',
        '  В терапии: рескриптинг',
        'Карающий Критик',
        '  Как проявляется: ругает за ошибки',
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
});
