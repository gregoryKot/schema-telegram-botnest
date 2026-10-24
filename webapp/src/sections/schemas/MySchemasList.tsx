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
}

const nameOf = (id: string) => {
  const found = findSchema(SCHEMA_DOMAINS, id);
  return found ? shortName(found.schema.name) : undefined;
};

/** «Мои схемы» на телефоне: строки по доменам, как в мини-аппе — название, статус карточки, частота. */
export function MySchemasList({ ids, onAdd, onOpenSchema, statusFor, freq }: Props) {
  return (
    <MineGroupsList
      kind="schema" groups={groupMineByDomain(SCHEMA_DOMAINS, ids)} nameOf={nameOf}
      addLabel="+ Добавить схему" onAdd={onAdd} onOpen={onOpenSchema} statusFor={statusFor} freq={freq}
    />
  );
}
