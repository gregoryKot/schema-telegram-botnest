// Сверка (правило №4): потолки и форма пути на бэкенде (therapy-path.types.ts — по ним валидирует DTO и
// собирает ответ сервис) и на сайте (shared/src/therapy/path/pathModel.ts). Бэкенд shared не импортирует,
// поэтому оба файла читаются текстом.
import { readFileSync } from 'fs';
import { join } from 'path';
import * as limits from './therapy-path.types';

const root = join(__dirname, '..', '..');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const site = strip(
  readFileSync(join(root, 'shared/src/therapy/path/pathModel.ts'), 'utf8'),
);
const server = strip(
  readFileSync(join(__dirname, 'therapy-path.types.ts'), 'utf8'),
);

/** Поля интерфейса: `имя: тип` без пробелов, в порядке объявления. */
function fields(src: string, name: string): string[] {
  const body = new RegExp(
    `export interface ${name} \\{([\\s\\S]*?)\\n\\}`,
  ).exec(src)?.[1];
  if (!body) throw new Error(`interface ${name} not found`);
  return body
    .split(';')
    .map((line) => line.replace(/\s+/g, ''))
    .filter(Boolean);
}

describe('путь клиента — бэкенд и сайт знают одни потолки и одну форму', () => {
  it.each([
    'PATH_PHASES_MAX',
    'PATH_PHASE_WEEKS_MAX',
    'PATH_PHASE_NAME_MAX',
    'PATH_PHASE_GOAL_MAX',
    'PATH_PHASE_NOTE_MAX',
  ] as const)('%s — то же число', (name) => {
    const onSite = new RegExp(`export const ${name} = (\\d+);`).exec(site)?.[1];
    expect(Number(onSite)).toBe(limits[name]);
  });

  it('фаза в ответе — те же поля тех же типов', () => {
    expect(fields(server, 'PathPhaseView')).toEqual(fields(site, 'PathPhase'));
  });

  it('путь в ответе — те же поля; фазы — список фаз', () => {
    expect(
      fields(server, 'TherapyPathView').map((f) =>
        f.replace('PathPhaseView[]', 'PathPhase[]'),
      ),
    ).toEqual(fields(site, 'TherapyPath'));
  });

  it('фаза к созданию — те же четыре поля, что берёт сайт', () => {
    const picked = [
      ...(
        /PathPhaseDraft = Pick<\s*PathPhase,([^>]+)>/.exec(site)?.[1] ?? ''
      ).matchAll(/'(\w+)'/g),
    ].map((m) => m[1]);
    expect(picked.length).toBeGreaterThan(0);
    expect(
      fields(server, 'PathPhaseDraft').map((f) => f.split(/\??:/)[0]),
    ).toEqual(picked);
  });
});
