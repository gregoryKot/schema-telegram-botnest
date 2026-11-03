import { NEED_ORDER, useNeedData } from '../../needs/needData';
import { needColor } from '../../needs/needColors';
import { ConceptToggleChip } from './ConceptToggleChip';
import { NEED_HUE } from '../../theme/entityHue';
import { labelStyle } from './graphStyles';

/** Пять потребностей чипами: у схемы ✗ «блокирует», у Здорового Взрослого ✓ «уже умеет». */
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
            hue={NEED_HUE[id]}
            active={needIds.includes(id)}
            onClick={() => toggle(id)}
          />
        ))}
      </div>
    </div>
  );
}
