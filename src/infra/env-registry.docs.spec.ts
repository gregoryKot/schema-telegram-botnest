// docs/ENV.md обязан быть синхронен с реестром — иначе документация тихо
// протухает (та же болезнь, что нашли гейты пула/дедфайлов у других
// реестров проекта). Не «сгенерировать заново», а сверить: каждая
// переменная реестра упомянута в документе, и наоборот.
import { readFileSync } from 'fs';
import { join } from 'path';
import { ENV_REGISTRY } from './env-registry.entries';

const DOC_PATH = join(__dirname, '..', '..', 'docs', 'ENV.md');
const doc = readFileSync(DOC_PATH, 'utf8');

describe('docs/ENV.md синхронен с ENV_REGISTRY', () => {
  it('каждая переменная реестра упомянута в докe (в code-разметке `NAME`)', () => {
    const missing = ENV_REGISTRY.filter(
      (e) => !doc.includes(`\`${e.name}\``),
    ).map((e) => e.name);
    expect(missing).toEqual([]);
  });

  it('в доке нет переменной, которой больше нет в реестре (протухшая документация)', () => {
    const mentioned = [...doc.matchAll(/\| `([A-Z][A-Z0-9_]*)` \|/g)].map(
      (m) => m[1],
    );
    const known = new Set(ENV_REGISTRY.map((e) => e.name));
    const stale = mentioned.filter((name) => !known.has(name));
    expect(stale).toEqual([]);
  });

  it('таблица не пуста', () => {
    const mentioned = [...doc.matchAll(/\| `([A-Z][A-Z0-9_]*)` \|/g)];
    expect(mentioned.length).toBe(ENV_REGISTRY.length);
  });
});
