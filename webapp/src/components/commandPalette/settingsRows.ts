// Строки общего поиска «Настройки»: весь лист, его разделы (реестр оглавления settingsNav.ts — второго
// списка нет), аккаунт и выход. Раздел открывается листом, прокрученным к нему (settingsLaunch.ts).
import { homeIconMode } from '../settingsSheet/homeIconMode';
import { settingsNav } from '../settingsSheet/settingsNav';
import type { CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteInput';

export const SETTINGS_GROUP = 'Настройки';

const row = (id: string, label: string, sub: string, words: string, action: () => void): CmdRow => ({
  key: `setting:${id}`, kind: 'setting', group: SETTINGS_GROUP, label, sub, mark: { sign: 'beads' },
  search: `${SETTINGS_GROUP} ${label} ${sub} ${words}`, action,
});

export function allSettingRows({ therapist, run }: PaletteInput): CmdRow[] {
  // Переключатель «Режим» лист показывает каждому терапевту (AppOverlays.tsx) — условие то же.
  const sections = settingsNav({ therapist, modeSwitch: therapist, homeIcon: !!homeIconMode() });
  return [
    row('main', SETTINGS_GROUP, 'Напоминания, обращение, данные', '', () => run.setting(null)),
    ...sections.map((s) => row(s.id, s.label, s.find, '', () => run.setting(s.id))),
    row('account', 'Аккаунт и способы входа', 'Привязки, двухфакторная защита', 'вход почта телеграм пароль', () => run.path('/account')),
    row('logout', 'Выйти', 'Выход из аккаунта на этом устройстве', '', () => run.logout()),
  ];
}
