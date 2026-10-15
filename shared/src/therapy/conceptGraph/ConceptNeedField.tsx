import { NEED_ORDER, useNeedData } from '../../needs/needData';
import { needColor } from '../../needs/needColors';
import { ConceptToggleChip } from './ConceptToggleChip';
import { labelStyle } from './graphStyles';

/** «Какая потребность не встретила ответа»: пять базовых потребностей. */
export function ConceptNeedField({
  needIds,
  onChange,
}: {
  needIds: string[];
  onChange: (needIds: string[]) => void;
}) {
  const needData = useNeedData();
  const toggle = (id: string) =>
    onChange(
      needIds.includes(id) ? needIds.filter((x) => x !== id) : [...needIds, id],
    );
  return (
    <div role="group" aria-label="Какая потребность не встретила ответа">
      <div style={{ ...labelStyle, marginBottom: 6 }}>
        Какая потребность не встретила ответа
      </div>
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
