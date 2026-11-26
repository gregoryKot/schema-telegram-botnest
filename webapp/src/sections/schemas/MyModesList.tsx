import { MODE_GROUPS, ALL_MODES } from '../../schemaTherapyData';
import { PaperEmpty } from '../../components/art/PaperEmpty';
import { useTr } from '../../utils/addressForm';
import { MineGroupsSkeleton } from './MineGroupsSkeleton';
import { MineGroupsList } from './MineGroupsList';
import { groupMineByModeGroup } from './mineGroups';

interface Props {
  loading: boolean;
  ids: string[];
  onAdd: () => void;
  onOpenMode: (id: string) => void;
  statusFor?: (id: string) => string;
  freq?: Record<string, number>;
  /** «+ Добавить режим» под группами (телефон); на компьютере добавление — в шапке блока. */
  withAdd?: boolean;
}

const nameOf = (id: string) => ALL_MODES.find(m => m.id === id)?.name;

/** «Мои режимы»: группы режимов на бумаге группы со знаком (телефон и компьютер). */
export function MyModesList({ loading, ids, onAdd, onOpenMode, statusFor, freq, withAdd = true }: Props) {
  const tr = useTr();
  if (loading) return <section className="cs-block"><MineGroupsSkeleton /></section>;
  return (
    <>
      {ids.length === 0 && <PaperEmpty>{tr('Добавь режимы, которые узнаёшь у себя', 'Добавьте режимы, которые узнаёте у себя')}</PaperEmpty>}
      <MineGroupsList
        kind="mode" groups={groupMineByModeGroup(MODE_GROUPS, ids)} nameOf={nameOf}
        addLabel={withAdd ? '+ Добавить режим' : undefined} onAdd={onAdd} onOpen={onOpenMode} statusFor={statusFor} freq={freq}
      />
    </>
  );
}
