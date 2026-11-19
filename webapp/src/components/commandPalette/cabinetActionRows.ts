// Действия кабинета терапевта в общем поиске: дать задание (второй шаг «Кому?»), добавить клиента,
// переключить «Показ экрана» — при том же условии, что переключатель в меню: есть клиенты.
import { THERAPIST_NAV } from '../appShell/navLook';
import type { CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteRows';
import { canAssign } from './taskRows';

export function cabinetActionRows(input: PaletteInput, group: string): CmdRow[] {
  const { clients, screenShare, run } = input;
  const share = screenShare
    ? { label: 'Выключить показ экрана', sub: 'Имена клиентов снова видны' }
    : { label: 'Включить показ экрана', sub: 'Имена клиентов скрыты в меню и в поиске' };
  const rows: (CmdRow | false)[] = [
    canAssign(input) && {
      key: 'action:assign-task', kind: 'action', group, label: 'Дать задание', sub: 'Выбрать клиента и задание',
      mark: { sign: THERAPIST_NAV.tasks.sign }, search: 'Дать задание Выбрать клиента и задание назначить',
      stay: true, action: () => run.pickAssignee(null),
    },
    {
      key: 'action:add-client', kind: 'action', group, label: 'Добавить клиента', sub: 'Новая карточка',
      mark: { sign: THERAPIST_NAV.clients.sign }, search: 'Добавить клиента Новая карточка новый клиент', action: run.addClient,
    },
    clients.length > 0 && {
      key: 'action:screen-share', kind: 'action', group, ...share,
      mark: { sign: 'cluster' }, search: `${share.label} ${share.sub} демонстрация`, action: run.toggleScreenShare,
    },
  ];
  return rows.filter((row): row is CmdRow => row !== false);
}
