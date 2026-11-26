// Сверка (правило №4): ключи фаз и id шаблонов в allow-list событий пути — те же, что в шаблонах сайта.
// Бэкенд shared не импортирует, поэтому файлы шаблонов читаются текстом.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { PATH_PHASE_KEYS, PATH_TEMPLATE_IDS } from './path-events.constants';

const dir = join(__dirname, '..', '..', 'shared/src/therapy/path/templates');
const files = readdirSync(dir).filter(
  (f) => f.endsWith('.ts') && !/^(index|types)\.ts$|\.test\.ts$/.test(f),
);
const read = (f: string) => readFileSync(join(dir, f), 'utf8');

describe('события пути клиента — allow-list знает все шаблоны и фазы', () => {
  it('id шаблонов (2 пробела отступа) + empty', () => {
    const ids = files.flatMap((f) =>
      [...read(f).matchAll(/^ {2}id: '([a-z0-9]+)'/gm)].map((m) => m[1]),
    );
    expect([...ids, 'empty'].sort()).toEqual([...PATH_TEMPLATE_IDS].sort());
  });

  it('ключи фаз (6 пробелов отступа) + custom', () => {
    const ids = files.flatMap((f) =>
      [...read(f).matchAll(/^ {6}id: '([a-z0-9]+)'/gm)].map((m) => m[1]),
    );
    expect([...ids, 'custom'].sort()).toEqual([...PATH_PHASE_KEYS].sort());
  });
});
