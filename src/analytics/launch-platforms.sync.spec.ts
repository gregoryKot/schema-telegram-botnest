// Правило №4: список платформ запуска на сайте (shared/src/host/launchPlatform.ts)
// и на сервере обязан совпадать. Сайт шлёт значение, которого нет на сервере, —
// оно молча становится `other`, и платформа пропадает из /stats.
// Бэкенд не импортирует shared/ в прод-коде, поэтому копия; shared — ESM,
// jest бэкенда его не грузит: транспилируем исходник и исполняем как есть
// (тот же приём, что notify-toggles.sync.spec.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';
import {
  LAUNCH_PLATFORMS,
  normalizeLaunchPlatform,
} from './launch-platforms.constants';

type Site = {
  LAUNCH_PLATFORMS: readonly string[];
  launchPlatform: (raw: string | undefined) => string;
};
function loadSite(): Site {
  const path = join(__dirname, '../../shared/src/host/launchPlatform.ts');
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} as Site };
  runInNewContext(js, { module: mod, exports: mod.exports });
  return mod.exports;
}
const site = loadSite();

describe('launch-platforms ↔ shared/src/host/launchPlatform.ts', () => {
  it('списки платформ совпадают', () => {
    expect([...site.LAUNCH_PLATFORMS]).toEqual([...LAUNCH_PLATFORMS]);
  });

  it.each(['ios', 'weba', 'unknown', '', 'tizen'])(
    '«%s» нормализуется одинаково на сайте и на сервере',
    (raw) => {
      expect(site.launchPlatform(raw)).toBe(normalizeLaunchPlatform(raw));
    },
  );
});
