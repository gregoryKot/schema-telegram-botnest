// Правило №4: тумблер «Напоминания» в /settings бота и на сайте обязан
// значить одно и то же (R2, аудит 2026-11). Бэкенд не импортирует shared/ в
// прод-коде, поэтому копия; спек сверяет её с оригиналом на всех сочетаниях.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';
import { remindersOn, remindersPatch, summaryOn } from './notify-toggles';

// shared/ — ESM-пакет ("type": "module"), jest бэкенда его не грузит:
// транспилируем исходник сайта и исполняем как есть.
type Toggles = {
  remindersOn: typeof remindersOn;
  remindersPatch: typeof remindersPatch;
  summaryOn: typeof summaryOn;
};
function loadSite(): Toggles {
  const path = join(__dirname, '../../shared/src/settings/notifyToggles.ts');
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} as Toggles };
  runInNewContext(js, { module: mod, exports: mod.exports });
  return mod.exports;
}
const site = loadSite();

const BOOLS = [true, false];

describe('notify-toggles ↔ shared/src/settings/notifyToggles.ts', () => {
  it.each(BOOLS.flatMap((e) => BOOLS.map((r) => [e, r] as const)))(
    'notifyEnabled=%s, notifyReminderEnabled=%s — одно состояние «Напоминаний»',
    (notifyEnabled, notifyReminderEnabled) => {
      const flags = { notifyEnabled, notifyReminderEnabled };
      expect(remindersOn(flags)).toBe(site.remindersOn(flags));
    },
  );

  it.each(BOOLS)('включение=%s пишет те же флаги', (on) => {
    expect(remindersPatch(on)).toEqual(site.remindersPatch(on));
  });

  it('нет настроек (новичок) — напоминания включены, как дефолт схемы', () => {
    expect(remindersOn(null)).toBe(true);
  });

  // «Итоги дня» — тумблер бота (settings:toggle_summary) и сайта читают флаг
  // одинаково; ответ без поля (старый сервер) — включены.
  it.each([true, false, undefined])(
    'notifySummaryEnabled=%s — одно состояние «Итогов дня»',
    (notifySummaryEnabled) => {
      const flags = { notifySummaryEnabled };
      expect(summaryOn(flags)).toBe(site.summaryOn(flags));
    },
  );
});
