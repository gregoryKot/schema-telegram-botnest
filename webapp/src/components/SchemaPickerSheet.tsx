import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { useAutosavedSelection } from '../../../shared/src/hooks/useAutosavedSelection';
import { ENTITY_LOOK, domainLook } from '../../../shared/src/theme/entityLook';
import { SsSheet, SsHead } from './schemaSheets/SsSheet';
import { PickRow, PickDone } from './schemaSheets/PickRow';
import { SignGroup } from './schemaSheets/SignGroup';

interface Props {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

/** «Мои схемы» — выбор без теста: лист-герой схем полосой, домены — листы бумаги со знаком домена
 *  (на ширине листа 720 — в две колонки), «Готово · N» в шапке и «Готово» в конце — как у режимов. */
export function SchemaPickerSheet({ selected, onSave, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const { ids, toggle } = useAutosavedSelection(selected, onSave);

  return (
    <SsSheet onBack={goBack} barRight={<PickDone count={ids.length} onClick={goBack} />}>
      <SsHead
        look="schemas" compact eyebrow="Схемы" title="Мои схемы"
        lede={tr('Выбери схемы, которые тебе близки. Можно без теста – если ты уже знаешь свои. Выбор сохраняется сразу.', 'Выберите схемы, которые вам близки. Можно без теста – если вы уже знаете свои. Выбор сохраняется сразу.')}
      />
      <div className="sg-cols-box"><div className="sg-cols">
        {SCHEMA_DOMAINS.map(domain => (
          <SignGroup key={domain.id} look={domainLook(domain.id) ?? ENTITY_LOOK.schemas} title={domain.domain}>
            {domain.schemas.map(s => (
              <PickRow key={s.id} name={s.name} desc={s.desc} active={ids.includes(s.id)} onToggle={() => toggle(s.id)} />
            ))}
          </SignGroup>
        ))}
      </div></div>
      <div className="ss-foot">
        <button className="ds-btn" onClick={goBack}>Готово</button>
      </div>
    </SsSheet>
  );
}
