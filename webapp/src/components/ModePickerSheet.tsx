import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { MODE_GROUPS, ALL_MODES } from '../schemaTherapyData';
import {
  MODE_DESC,
  POPULAR_MODE_IDS,
} from '../../../shared/src/mode/modePickerDesc';
import { useAutosavedSelection } from '../../../shared/src/hooks/useAutosavedSelection';
import { PAPER_HUE, modeGroupLook } from '../../../shared/src/theme/entityLook';
import { SsSheet, SsHead } from './schemaSheets/SsSheet';
import { PickRow, PickDone } from './schemaSheets/PickRow';
import { SignGroup } from './schemaSheets/SignGroup';

/** «С чего начать» — подборка частых режимов: солома и галочка, как первый шаг. */
const START_LOOK = { hue: PAPER_HUE.straw, sign: 'check' } as const;

// Выбиралка режимов — вынесена из SchemasSection.tsx (правило №10, потолок
// файла). Кнопка «Готово» только закрывает (автосохранение —
// useAutosavedSelection, жалоба пользователя, закрытый PR #237). Вид — как у
// «Моих схем»: лист-герой режимов полосой, группы — бумага группы со знаком.
export function ModePickerSheet({
  selected,
  onSave,
  onClose,
}: {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const { ids, toggle } = useAutosavedSelection(selected, onSave);
  const row = (id: string, name: string) => (
    <PickRow key={id} name={name} desc={MODE_DESC[id]} active={ids.includes(id)} onToggle={() => toggle(id)} />
  );

  return (
    <SsSheet onBack={goBack} barRight={<PickDone count={ids.length} onClick={goBack} />}>
      <SsHead
        look="modes" compact title="Мои режимы"
        lede={tr('Выбери режимы которые ты замечаешь у себя. Выбор сохраняется сразу.', 'Выберите режимы которые вы замечаете у себя. Выбор сохраняется сразу.')}
      />
      <SignGroup look={START_LOOK} title="С чего начать">
        {POPULAR_MODE_IDS.map(id => {
          const mode = ALL_MODES.find(m => m.id === id);
          return mode ? row(id, mode.name) : null;
        })}
      </SignGroup>
      <div className="ds-label ss-pick-all">Все режимы</div>
      <div className="sg-cols-box"><div className="sg-cols">
        {MODE_GROUPS.map(group => (
          <SignGroup key={group.id} look={modeGroupLook(group.id)} title={group.group}>
            {group.items.filter(m => !POPULAR_MODE_IDS.includes(m.id)).map(m => row(m.id, m.name))}
          </SignGroup>
        ))}
      </div></div>
    </SsSheet>
  );
}
