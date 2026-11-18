// Тест-сверка (№4): содержимое сида статей закреплено за SEED_VERSION.
// Правка articles.seed.ts без бампа версии не доезжает до прода: сид на старте
// сверяется только при смене версии (articles.seed-sync.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import { SEED_VERSION } from './articles.service';
import { seedContentHash } from './articles.seed-sync';

interface SeedLock {
  version: string;
  hash: string;
}

const LOCK_PATH = 'src/articles/articles.seed.lock.json';

/** null — сид и версия совпадают с lock; иначе — что не так и что делать. */
function lockProblem(lock: SeedLock, actual: SeedLock): string | null {
  if (actual.hash !== lock.hash && actual.version === lock.version) {
    return (
      `Сид статей изменился, а SEED_VERSION (${actual.version}) нет: правка не доедет до прода. ` +
      'Подними SEED_VERSION в src/articles/articles.service.ts, затем перезапусти этот тест: ' +
      `он покажет новую строку для ${LOCK_PATH}.`
    );
  }
  if (actual.hash !== lock.hash || actual.version !== lock.version) {
    return `${LOCK_PATH} устарел. Запиши в него: ${JSON.stringify(actual)}`;
  }
  return null;
}

describe('articles.seed.lock.json: сид статей закреплён за SEED_VERSION', () => {
  it('содержимое сида и SEED_VERSION совпадают с lock', () => {
    const lock = JSON.parse(
      readFileSync(join(__dirname, 'articles.seed.lock.json'), 'utf8'),
    ) as SeedLock;
    const problem = lockProblem(lock, {
      version: SEED_VERSION,
      hash: seedContentHash(),
    });
    if (problem) throw new Error(problem);
  });

  it('правка сида без бампа версии — красное с подсказкой поднять SEED_VERSION', () => {
    const msg = lockProblem(
      { version: '7', hash: 'old' },
      { version: '7', hash: 'new' },
    );
    expect(msg).toContain('Подними SEED_VERSION');
    expect(msg).not.toContain('"hash":"new"');
  });

  it('версия поднята, lock старый — красное с новой парой для lock', () => {
    const msg = lockProblem(
      { version: '7', hash: 'old' },
      { version: '8', hash: 'new' },
    );
    expect(msg).toContain('{"version":"8","hash":"new"}');
  });

  it('версия и хеш совпадают — зелёное', () => {
    expect(
      lockProblem({ version: '7', hash: 'h' }, { version: '7', hash: 'h' }),
    ).toBeNull();
  });
});
