import { useState } from 'react';
import { Disclosure, type DisclosureClasses } from '../../../../../shared/src/components/Disclosure';
import { CHILDHOOD_EXAMPLES } from '../../../../../shared/src/childhoodWheel/childhoodExamples';
import { childhoodLevel } from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import type { NeedId } from '../../../../../shared/src/needs/types';
import '../../../styles/sheet-childhood.css';

const LIST: DisclosureClasses = { root: 'chw-examples', btn: 'ds-link chw-examples-toggle', label: '', chev: 'ds-fold-chev', body: 'chw-examples-list' };

/**
 * «Примеры – как это выглядит в жизни» под ползунком потребности: четыре
 * точки шкалы с живыми историями. Механика — общая Disclosure, шеврон ds-fold-chev.
 */
export function NeedExamples({ needId }: { needId: NeedId }) {
  return (
    <Disclosure classes={LIST} title="Примеры – как это выглядит в жизни">
      <ExampleList needId={needId} />
    </Disclosure>
  );
}

// Открыт один пример; список размонтируется вместе с закрытой раскрывашкой — выбор сбрасывается сам.
function ExampleList({ needId }: { needId: NeedId }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <>
      {CHILDHOOD_EXAMPLES[needId].map((ex, i) => (
        <Disclosure
          key={i}
          classes={{ root: 'chw-example', btn: 'ds-fold-btn chw-example-head', label: 'chw-badge is-' + childhoodLevel(ex.score), chev: 'ds-fold-chev', body: 'chw-example-text' }}
          title={`≈${ex.score}/10`}
          open={openIdx === i}
          onToggle={() => setOpenIdx(openIdx === i ? null : i)}
        >
          {ex.text}
        </Disclosure>
      ))}
    </>
  );
}
