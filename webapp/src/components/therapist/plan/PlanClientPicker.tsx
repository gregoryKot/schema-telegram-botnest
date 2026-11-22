import { clientDisplayName } from '../../../../../shared/src/therapy/clientInitials';
import { Skeleton } from '../../Skeleton';
import { useTherapyClientList } from '../useTherapyClientList';

/** Сервер принимает за раз не больше стольких клиентов. */
const CLIENTS_MAX = 50;

interface Props {
  picked: string[];
  onToggle: (id: string) => void;
}

/** «Кому в план» из общего справочника: список клиентов терапевта, отмеченные получают пункт. */
export function PlanClientPicker({ picked, onToggle }: Props) {
  const clients = useTherapyClientList(true);
  return (
        <fieldset className="pa-block pa-set">
          <legend className="ds-label">Кому в план</legend>
          {clients === undefined && <Skeleton height={44} />}
          {clients === null && <span className="tb-error" role="alert">Список клиентов не загрузился</span>}
          {clients?.length === 0 && <span className="ds-sub">Клиентов пока нет — план ведётся в карточке клиента.</span>}
          {clients?.map((c) => {
            const id = String(c.telegramId);
            const on = picked.includes(id);
            return (
              <label key={id} className="pa-check">
                <input type="checkbox" checked={on} disabled={!on && picked.length >= CLIENTS_MAX} onChange={() => onToggle(id)} />
                <span>{clientDisplayName(c)}</span>
              </label>
            );
          })}
        </fieldset>
  );
}
