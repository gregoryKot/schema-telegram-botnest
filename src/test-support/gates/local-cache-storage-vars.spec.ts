// Тест гейта check-local-cache-writers.mjs: запись через хранилище, которое
// движок получает параметром ("storageVars" реестра, local-cache-writes.mjs).
// Так пишет свои маркеры uiPrefsSync.ts (PrefStorage): без объявления гейт их
// не видел, и второй писатель маркера прошёл бы молча. Оба исхода + образцы.
import { readFileSync } from 'fs';
import { join } from 'path';
import { REAL_SCRIPTS_DIR, runGate } from './gate-sandbox';
import { importExport } from './pattern-loader';

const SCRIPT = 'check-local-cache-writers.mjs';
const REASON = 'синхронизатор пишет ключи через переданный ему storage';
const ENGINE = 'shared/src/prefs/sync.ts';
const SYNC = [
  "const MARKER = 'sync_marker';",
  "const DIRTY = 'sync_dirty';",
  'export function apply(prefs: Record<string, string>, storage: Storage) {',
  '  for (const key of Object.keys(prefs)) storage.setItem(key, prefs[key]);',
  "  storage.setItem(MARKER, '1');",
  '  storage.removeItem(DIRTY);',
  "  sessionStorage.setItem('tab_state', '1');",
  '}',
  '',
].join('\n');
const MARKERS = {
  sync_marker: { owner: ENGINE, kind: 'local' },
  sync_dirty: { owner: ENGINE, kind: 'local' },
};

function files(
  keys: Record<string, unknown>,
  engine: Record<string, unknown> = { storageVars: ['storage'] },
  extra: Record<string, string> = {},
) {
  const engines = { [ENGINE]: { functions: [], reason: REASON, ...engine } };
  return {
    [ENGINE]: SYNC,
    ...extra,
    'scripts/local-cache-baseline.json': JSON.stringify({ keys, engines }),
  };
}

describe('check-local-cache-writers.mjs: storageVars движка', () => {
  it('маркеры через storage видны, владелец — движок; sessionStorage не в счёт — exit 0', () => {
    const res = runGate(SCRIPT, files(MARKERS));
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('2 ключей, 1 движков');
  });

  // Ядро: второй писатель маркера. Раньше гейт молчал, если реестр называл
  // владельцем его, — запись движка через storage в счёт не шла.
  it('второй писатель маркера в другом файле — exit 1 при любом владельце в реестре', () => {
    const reset = {
      'webapp/src/reset.ts':
        "export const reset = () => localStorage.removeItem('sync_marker');\n",
    };
    const asOwner = runGate(SCRIPT, files(MARKERS, undefined, reset));
    expect(asOwner.status).toBe(1);
    expect(asOwner.stderr).toContain(
      `sync_marker: второй писатель webapp/src/reset.ts:1 (владелец ${ENGINE})`,
    );
    const hijacked = runGate(
      SCRIPT,
      files(
        {
          ...MARKERS,
          sync_marker: { owner: 'webapp/src/reset.ts', kind: 'local' },
        },
        undefined,
        reset,
      ),
    );
    expect(hijacked.status).toBe(1);
    expect(hijacked.stderr).toContain(
      `sync_marker: второй писатель ${ENGINE}:5 (владелец webapp/src/reset.ts)`,
    );
  });

  it('маркер без записи в реестре — exit 1, строка записи названа', () => {
    const res = runGate(SCRIPT, files({}));
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      `sync_marker: ключ без записи в реестре; пишут: ${ENGINE}:5`,
    );
    expect(res.stderr).toContain(
      `sync_dirty: ключ без записи в реестре; пишут: ${ENGINE}:6`,
    );
  });

  // Контрольный образец: без объявления запись через storage не видна —
  // ключи движка в реестре становятся протухшими, а не «зелёными».
  it('без storageVars маркеры не видны — запись в реестре протухла, exit 1', () => {
    const res = runGate(SCRIPT, files(MARKERS, {}));
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('sync_marker: протухшая запись');
  });

  it('storageVars без единой записи или не список имён — exit 1', () => {
    const idle = runGate(
      SCRIPT,
      files(MARKERS, { storageVars: ['storage', 'store'] }),
    );
    expect(idle.status).toBe(1);
    expect(idle.stderr).toContain(
      `движок ${ENGINE}: storageVars «store» — в файле нет store.setItem/removeItem`,
    );
    const broken = runGate(SCRIPT, files(MARKERS, { storageVars: 'storage' }));
    expect(broken.status).toBe(1);
    expect(broken.stderr).toContain(
      `движок ${ENGINE}: storageVars — список имён переменных-хранилищ`,
    );
  });

  // Слой поиска напрямую: тот же метод у чужого объекта (this.storage,
  // sessionStorage, localStorage) — не запись через объявленный storage.
  it('local-cache-writes.mjs: в счёт идёт только `<имя>.setItem/removeItem` как есть', () => {
    const src = [
      "this.storage.setItem('a', '1');",
      "opts.storage.removeItem('b');",
      "sessionStorage.setItem('c', '1');",
      "localStorage.setItem('d', '1');",
    ].join('\n');
    const problems = JSON.parse(
      importExport(
        'local-cache-writes.mjs',
        'storageVarProblems',
        `(fn) => fn('x.ts', ${JSON.stringify(src)}, ['storage'])`,
      ),
    ) as string[];
    expect(problems).toEqual([
      'движок x.ts: storageVars «storage» — в файле нет storage.setItem/removeItem (протухшая запись)',
    ]);
  });

  it('реестр репозитория: маркеры uiPrefsSync под гейтом, владелец — uiPrefsSync.ts', () => {
    const real = JSON.parse(
      readFileSync(join(REAL_SCRIPTS_DIR, 'local-cache-baseline.json'), 'utf8'),
    ) as {
      keys: Record<string, { owner: string }>;
      engines: Record<string, { storageVars?: string[] }>;
    };
    const owner = 'shared/src/prefs/uiPrefsSync.ts';
    expect(real.engines[owner].storageVars).toEqual(['storage']);
    expect(real.keys.ui_prefs_migrated.owner).toBe(owner);
    expect(real.keys.ui_prefs_dirty.owner).toBe(owner);
  });
});
