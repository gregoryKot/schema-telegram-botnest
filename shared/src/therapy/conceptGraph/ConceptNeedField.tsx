import { NEED_ORDER, useNeedData } from '../../needs/needData';
import { needColor } from '../../needs/needColors';
import { ConceptToggleChip } from './ConceptToggleChip';
import { labelStyle } from './graphStyles';

/**
 * Пять базовых потребностей чипами. Подпись говорит, что значит выбор: у схемы
 * это ✗ («блокирует»), у Здорового Взрослого — ✓ («уже умеет заботиться»).
 */
export function ConceptNeedField({
  label,
  needIds,
  onChange,
}: {
  label: string;
  needIds: string[];
  onChange: (needIds: string[]) => void;
}) {
  const needData = useNeedData();
  const toggle = (id: string) =>
    onChange(
      needIds.includes(id) ? needIds.filter((x) => x !== id) : [...needIds, id],
    );
  return (
    <div role="group" aria-label={label}>
      <div style={{ ...labelStyle, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
        {NEED_ORDER.map((id) => (
          <ConceptToggleChip
            key={id}
            label={needData[id].name}
            color={needColor(id)}
            active={needIds.includes(id)}
            onClick={() => toggle(id)}
          />
        ))}
      </div>
    </div>
  );
}
