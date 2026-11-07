// Правило №4: подпись безымянного клиента живёт копией — доска заданий
// получает её с сервера, остальной кабинет считает на сайте
// (shared/src/therapy/clientInitials.ts). Тест падает, если формы разошлись.
import { readFileSync } from 'fs';
import { join } from 'path';
import { UNNAMED_CLIENT, unnamedClientLabel } from './client-display-name';

const shared = readFileSync(
  join(__dirname, '..', '..', 'shared', 'src', 'therapy', 'clientInitials.ts'),
  'utf8',
);

describe('client-display-name ↔ shared/src/therapy/clientInitials.ts', () => {
  it('то же слово для клиента без имени', () => {
    expect(shared).toContain(
      `export const UNNAMED_CLIENT = '${UNNAMED_CLIENT}';`,
    );
  });

  it('тот же формат «слово · номер», номер без минуса', () => {
    expect(shared).toContain('`${UNNAMED_CLIENT} · ${');
    expect(shared).toContain(".replace(/^-/, '')");
    expect(unnamedClientLabel(123n)).toBe('Без имени · 123');
    expect(unnamedClientLabel(-42n)).toBe('Без имени · 42');
  });
});
