import { renderTemplate } from './notification.templates';

const mode = { kind: 'mode', key: 'punitive_critic', count: 3 };
const need = { kind: 'need', key: 'play', count: 2 };

describe('weekly_repeat template', () => {
  it('Telegram: без названий, с кнопкой в «Карту себя»', () => {
    const t = renderTemplate('weekly_repeat', need, 'ty', 'telegram');
    expect(t?.text).not.toContain('Спонтанность');
    expect(JSON.stringify(t?.keyboard?.reply_markup)).toContain(
      'startapp=selfmap',
    );
    expect(renderTemplate('weekly_repeat', mode)?.text).toBe(t?.text);
  });

  it('push: потребность с названием и склонением дней', () => {
    const t = renderTemplate('weekly_repeat', need, 'ty', 'push');
    expect(t?.text).toContain('«Спонтанность» — 2 дня');
  });

  it('push: режим с фразой без вложенных кавычек и склонением раз/раза', () => {
    const t = renderTemplate('weekly_repeat', mode, 'ty', 'push');
    expect(t?.text).toContain('— 3 раза');
    expect(t?.text).not.toContain('««');
    expect(
      renderTemplate(
        'weekly_repeat',
        { ...mode, key: 'angry_child', count: 5 },
        'vy',
        'push',
      )?.text,
    ).toContain('— 5 раз');
  });

  it('push: неизвестный ключ или битый payload — общий текст, а не сырой id', () => {
    const generic = renderTemplate(
      'weekly_repeat',
      undefined,
      'ty',
      'push',
    )?.text;
    expect(
      renderTemplate(
        'weekly_repeat',
        { kind: 'mode', key: 'zzz', count: 2 },
        'ty',
        'push',
      )?.text,
    ).toBe(generic);
    expect(generic).not.toContain('zzz');
  });
});
