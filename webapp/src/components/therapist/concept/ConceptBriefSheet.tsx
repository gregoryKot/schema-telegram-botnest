import { useMemo } from 'react';
import { useTr } from '../../../utils/addressForm';
import type { ClientDetail } from '../clientSheetTypes';
import { ConceptFullscreenSheet } from '../ConceptFullscreenSheet';
import { DigestChips } from '../../../../../shared/src/therapy/conceptGraph/ConceptDigest';
import { hueVar } from '../../../../../shared/src/therapy/conceptGraph/conceptChipStyle';
import {
  BRIEF_BLOCKS,
  buildConceptBrief,
  type BriefSection,
} from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';
import { useBriefBlocks } from './useBriefBlocks';

export const BRIEF_TITLE = 'Главное';

// Экран «Главное»: самое важное из концептуализации на одном экране — карточки
// выбранных блоков сеткой, без прокрутки до фигур и полей. Какие блоки
// показывать, терапевт отмечает чипами под шапкой (выбор запоминается на
// устройстве — useBriefBlocks). Только чтение; данные те же, что в видах «Схема»
// и «Поля», с черновиком поверх. Лист — общий ConceptFullscreenSheet.
export function ConceptBriefSheet({ detail, onClose }: { detail: ClientDetail; onClose: () => void }) {
  const tr = useTr();
  const [ids, toggle] = useBriefBlocks();
  const { concept, localConcept, selectedClient } = detail;
  const sections = useMemo(() => buildConceptBrief(concept, localConcept, ids), [concept, localConcept, ids]);
  const who = selectedClient?.clientAlias ?? selectedClient?.name;
  const picker = (
    <div className="tcp-brief-pick">
      <div className="ds-sub">
        {tr('Что показывать — выбери, выбор запомнится.', 'Что показывать — выберите, выбор запомнится.')}
      </div>
      <div className="tcp-chips" role="group" aria-label="Что показывать">
        {BRIEF_BLOCKS.map((b) => {
          const on = ids.includes(b.id);
          return (
            <button
              key={b.id} type="button" aria-pressed={on}
              className={`ds-chip ds-chip--toggle${on ? ' is-on' : ''}`}
              onClick={() => toggle(b.id)}
            >
              {b.label}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <ConceptFullscreenSheet title={who ? `${BRIEF_TITLE} · ${who}` : BRIEF_TITLE} closeLabel="Закрыть" onClose={onClose} sub={picker}>
      {sections.length === 0 ? (
        <p className="ds-sub tcp-brief-none">{tr('Ни один блок не выбран — отметь выше, что показывать.', 'Ни один блок не выбран — отметьте выше, что показывать.')}</p>
      ) : (
        <div className="tcp-brief-grid">
          {sections.map((s) => <BriefCard key={s.id} section={s} />)}
        </div>
      )}
    </ConceptFullscreenSheet>
  );
}

function BriefCard({ section: s }: { section: BriefSection }) {
  return (
    <section className={`ds-card ds-card--row tcp-brief-card${s.kind === 'text' ? ' tcp-brief-card--text' : ''}`} aria-label={s.label}>
      <h3 className="ds-label tcp-brief-label">{s.label}</h3>
      {s.empty ? (
        <div className="tcp-brief-empty">—</div>
      ) : s.kind === 'chips' ? (
        <DigestChips items={s.items} />
      ) : s.kind === 'modes' ? (
        <ul className="tcp-brief-modes">
          {s.modes.map((m) => (
            <li key={m.modeId} className="tcp-brief-mode">
              <span className="tcp-brief-mode-head">
                <span className="ds-dot tone-fill" style={hueVar(m.hue)} aria-hidden />
                <b>{m.name}</b>
                <span className="ds-sub">{m.lane}</span>
              </span>
              {m.manifest && <div className="tcp-brief-mode-text">{m.manifest}</div>}
              {m.schemas.length > 0 && <div className="ds-sub">Схемы: {m.schemas.join(' · ')}</div>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="tcp-brief-text">{s.text}</div>
      )}
    </section>
  );
}
