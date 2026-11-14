// «Текущий состав» в test/fixtures/recorded/README.md сверяется с каталогом:
// список отстал на десяток фикстур, и о записи площадки нельзя было узнать из README.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DIR = join(__dirname, '..', '..', '..', 'test', 'fixtures', 'recorded');

/** Файл назван в README целиком или маской `префикс-*.расширение`. */
function listedIn(readme: string, file: string): boolean {
  if (readme.includes(`\`${file}\``)) return true;
  const masks = readme.match(/`[\w.-]+-\*\.\w+`/g) ?? [];
  return masks.some((m) => {
    const [prefix, ext] = m.slice(1, -1).split('*');
    return file.startsWith(prefix) && file.endsWith(ext);
  });
}

describe('test/fixtures/recorded/README.md — «Текущий состав»', () => {
  it('каждая фикстура каталога названа в README', () => {
    const readme = readFileSync(join(DIR, 'README.md'), 'utf8');
    const fixtures = readdirSync(DIR).filter(
      (f) => f !== 'README.md' && !f.endsWith('.meta.json'),
    );
    expect(fixtures.filter((f) => !listedIn(readme, f))).toEqual([]);
  });

  it('маска ловит своё и не ловит чужое расширение', () => {
    const readme = '| `npm-audit-*.json` | … |';
    expect(listedIn(readme, 'npm-audit-high.json')).toBe(true);
    expect(listedIn(readme, 'npm-audit-high.xml')).toBe(false);
    expect(listedIn(readme, 'github-rulesets.json')).toBe(false);
  });
});
