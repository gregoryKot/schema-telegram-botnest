import type { ReactNode } from 'react';
import type { SheetLook } from '../../../../shared/src/theme/entityLook';
import { SignGroup } from '../schemaSheets/SignGroup';

export interface PaperGroupData {
  id: string;
  name: string;
  /** Бумага и знак группы: домен — domainLook, группа режимов — modeGroupLook. */
  look: SheetLook;
  items: { id: string; name: string }[];
}

interface Props {
  label: string;
  /** Правый слот шапки: счётчик («4 в работе») … */
  sub?: string;
  /** … или ссылка-действие («Редактировать →»). */
  action?: ReactNode;
  groups: PaperGroupData[];
}

// Секция «Обзора» с группами — домены схем, группы режимов (b30, принцип 10): та же группа на бумаге, что у
// клиента в «Моих паттернах» и в «Справочнике» (SignGroup: лист домена или группы, знак 60 у подписи, белый
// список строк). Подпись секции — ds-label без своего знака: знаки несут группы. Колонки — по ширине самой
// колонки «Обзора» (контейнер .tk-groups-box, therapist-card.css), а не окна.
export function PaperGroups({ label, sub, action, groups }: Props) {
  return (
    <section className="tk-sec">
      <div className="ds-head-row tk-card-head">
        <h2 className="ds-label tk-sec-label">{label}</h2>
        {sub && <span className="ds-sub">{sub}</span>}
        {action}
      </div>
      <div className="tk-groups-box">
        <div className="tk-groups">
          {groups.map(g => (
            <SignGroup key={g.id} look={g.look} title={g.name} rowsClassName="tk-rows">
              {g.items.map(i => <div key={i.id} className="tk-item">{i.name}</div>)}
            </SignGroup>
          ))}
        </div>
      </div>
    </section>
  );
}
