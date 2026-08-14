// Тест гейта check-paired-files.mjs — правило №3 CLAUDE.md «парные файлы
// webapp ↔ schema-miniapp правятся парой». Список пар зашит в самом скрипте
// (PAIRS), поэтому позитивный кейс дублирует его здесь — если список в
// скрипте изменится, список ниже придётся обновить вместе с ним (это
// свойство самого гейта, не тестовая условность).
import { runGate } from './gate-sandbox';

// Копия PAIRS из scripts/check-paired-files.mjs.
const PAIRS = [
  'types.ts',
  'utils/therapistContact.ts',
  'utils/crisisMarkers.ts',
  'utils/crisisMarkers.test.ts',
  'utils/todayInsight.ts',
  'utils/drafts.ts',
  'utils/addressForm.ts',
  'utils/AddressFormProvider.tsx',
  'components/CrisisCard.tsx',
  'hooks/useYsqTest.ts',
  'hooks/useYsqTest.test.ts',
  'utils/format.ts',
  'utils/format.test.ts',
  'utils/storageKeys.ts',
  'utils/a11y.ts',
  'utils/reducedMotion.ts',
  'hooks/useReducedMotionPref.ts',
  'utils/telemetryUrl.ts',
  'utils/telemetryUrl.test.ts',
];

describe('check-paired-files.mjs', () => {
  it('пара разошлась содержимым — exit 1, называет конкретный файл', () => {
    const res = runGate('check-paired-files.mjs', {
      'webapp/src/types.ts': 'export type Foo = 1;\n',
      'schema-miniapp/src/types.ts': 'export type Foo = 2;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('парные файлы разошлись: types.ts');
  });

  // До этого теста catch-ветка (файл пары физически отсутствует хотя бы в
  // одном из деревьев) исполнялась в фикстурах (остальные PAIRS-записи не
  // создавались в тесте выше), но её `failed = true;` ни разу не проверялся
  // отдельно — тест 1 проходил и без него благодаря content-mismatch.
  it('файл пары физически отсутствует в одном из деревьев — exit 1', () => {
    const res = runGate('check-paired-files.mjs', {
      'webapp/src/types.ts': 'export type Foo = 1;\n',
      // schema-miniapp/src/types.ts не создан вовсе.
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('пара отсутствует: types.ts');
  });

  it('все пары побайтово идентичны в обоих деревьях — exit 0', () => {
    const files: Record<string, string> = {};
    for (const p of PAIRS) {
      const content = `// placeholder for ${p}\n`;
      files[`webapp/src/${p}`] = content;
      files[`schema-miniapp/src/${p}`] = content;
    }
    const res = runGate('check-paired-files.mjs', files);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      `✓ парные файлы идентичны (${PAIRS.length} пар)`,
    );
  });
});
