import { describe, it, expect } from 'vitest';
import { settingsNav } from './settingsNav';

const labels = (o: Parameters<typeof settingsNav>[0]) => settingsNav(o).map((n) => n.label);

describe('settingsNav — порядок групп настроек', () => {
  it('клиент: имя и обращение первыми, «Специалист» после «Поделиться», «Данные» последними', () => {
    expect(labels({ therapist: false, modeSwitch: false, homeIcon: true })).toEqual([
      'Имя', 'Обращение', 'Уведомления', 'Оформление', 'Значок на экране', 'Мой терапевт', 'Партнёр', 'Поделиться',
      'Специалист', 'О приложении', 'Данные',
    ]);
  });
  it('терапевт: «Режим» первым, «Кабинет» на месте «Моего терапевта», заявки «Специалист» нет', () => {
    expect(labels({ therapist: true, modeSwitch: true, homeIcon: false })).toEqual([
      'Режим', 'Имя', 'Обращение', 'Уведомления', 'Оформление', 'Кабинет', 'Партнёр', 'Поделиться', 'О приложении', 'Данные',
    ]);
  });
  it('без переключателя режима и без значка этих строк нет; id уникальны', () => {
    const items = settingsNav({ therapist: true, modeSwitch: false, homeIcon: false });
    expect(items.map((n) => n.id)).not.toContain('s-mode');
    expect(items.map((n) => n.id)).not.toContain('s-home');
    expect(new Set(items.map((n) => n.id)).size).toBe(items.length);
  });
});
