import { MODE_GROUPS, ALL_MODES } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { Skeleton } from '../../components/Skeleton';
import { MineGroupsList } from './MineGroupsList';
import { groupMineByModeGroup } from './mineGroups';

interface Props {
  loading: boolean;
  ids: string[];
  onAdd: () => void;
  onOpenMode: (id: string) => void;
  statusFor?: (id: string) => string;
  freq?: Record<string, number>;
}

const nameOf = (id: string) => ALL_MODES.find(m => m.id === id)?.name;

/** «Мои режимы» на телефоне: строки по группам режимов, как в мини-аппе. */
export function MyModesList({ loading, ids, onAdd, onOpenMode, statusFor, freq }: Props) {
  const tr = useTr();
  if (loading) return <section className="cs-block"><Skeleton height={64} radius={20} /><Skeleton height={64} radius={20} /></section>;
  return (
    <>
      {ids.length === 0 && (
        <p className="cs-empty">{tr('Добавь режимы, которые узнаёшь у себя', 'Добавьте режимы, которые узнаёте у себя')}</p>
      )}
      <MineGroupsList
        kind="mode" groups={groupMineByModeGroup(MODE_GROUPS, ids)} nameOf={nameOf}
        addLabel="+ Добавить режим" onAdd={onAdd} onOpen={onOpenMode} statusFor={statusFor} freq={freq}
      />
    </>
  );
}
