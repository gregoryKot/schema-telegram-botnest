import { useMemo } from 'react';
import { useTr } from '../../../utils/addressForm';
import type { ClientDetail } from '../clientSheetTypes';
import { ConceptFullscreenSheet } from '../ConceptFullscreenSheet';
import { SignChip } from '../../paper/SignChip';
import { ConceptBriefCard } from './ConceptBriefCard';
import { BRIEF_BLOCKS, buildConceptBrief } from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';
import { useBriefBlocks } from './useBriefBlocks';
import { briefColumnCount, briefWeight, packBrief } from './briefColumns';
import { useContainerWidth } from '../../../../../shared/src/therapy/conceptGraph/diagram/useContainerWidth';

export const BRIEF_TITLE = 'Главное';

// Экран «Главное»: самое важное из концептуализации на одном экране — листы выбранных блоков бенто
// (три колонки на компьютере, раскладка — briefColumns.ts), без прокрутки до фигур и полей. Какие блоки показывать, терапевт
// отмечает чипами под шапкой (выбор запоминается на устройстве — useBriefBlocks). Только чтение; данные те же, что в видах «Схема»
// и «Поля», с черновиком поверх. Лист — общий ConceptFullscreenSheet.
export function ConceptBriefSheet({ detail, onClose }: { detail: ClientDetail; onClose: () => void }) {
  const tr = useTr();
  const [ids, toggle] = useBriefBlocks();
  const { concept, localConcept, selectedClient } = detail;
  const sections = useMemo(() => buildConceptBrief(concept, localConcept, ids), [concept, localConcept, ids]);
  const who = selectedClient?.clientAlias ?? selectedClient?.name;
  const [gridRef, width] = useContainerWidth(0);
  const columns = packBrief(sections, briefColumnCount(width), briefWeight);
  const picker = (
    <div className="tcp-brief-pick">
      <div className="ds-sub">
        {tr('Что показывать — выбери, выбор запомнится.', 'Что показывать — выберите, выбор запомнится.')}
      </div>
      <div className="tcp-chips" role="group" aria-label="Что показывать">
        {BRIEF_BLOCKS.map((b) => <SignChip key={b.id} className="tcp-brief-chip" label={b.label} on={ids.includes(b.id)} onToggle={() => toggle(b.id)} />)}
      </div>
    </div>
  );
  return (
    <ConceptFullscreenSheet title={who ? `${BRIEF_TITLE} · ${who}` : BRIEF_TITLE} closeLabel="Закрыть" onClose={onClose} sub={picker}>
      {sections.length === 0 ? (
        <p className="ds-sub tcp-brief-none">{tr('Ни один блок не выбран — отметь выше, что показывать.', 'Ни один блок не выбран — отметьте выше, что показывать.')}</p>
      ) : (
        <div ref={gridRef} className="tcp-brief-grid">
          {columns.map((col) => (
            <div key={col[0]?.id} className="tcp-brief-col">{col.map((s) => <ConceptBriefCard key={s.id} section={s} />)}</div>
          ))}
        </div>
      )}
    </ConceptFullscreenSheet>
  );
}
