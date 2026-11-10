import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { MineGroupsList } from './MineGroupsList';
import { findSchema, shortName } from './schemasModel';
import { groupMineByDomain } from './mineGroups';

interface Props {
  ids: string[];
  onAdd: () => void;
  onOpenSchema: (id: string) => void;
  statusFor?: (id: string) => string;
  freq?: Record<string, number>;
  /** «+ Добавить схему» под группами (телефон); на компьютере добавление — в шапке блока. */
  withAdd?: boolean;
}

const nameOf = (id: string) => {
  const found = findSchema(SCHEMA_DOMAINS, id);
  return found ? shortName(found.schema.name) : undefined;
};

/** «Мои схемы»: группы по доменам — название, статус карточки, частота (телефон и компьютер). */
export function MySchemasList({ ids, onAdd, onOpenSchema, statusFor, freq, withAdd = true }: Props) {
  return (
    <MineGroupsList
      kind="schema" groups={groupMineByDomain(SCHEMA_DOMAINS, ids)} nameOf={nameOf}
      addLabel={withAdd ? '+ Добавить схему' : undefined} onAdd={onAdd} onOpen={onOpenSchema} statusFor={statusFor} freq={freq}
    />
  );
}
