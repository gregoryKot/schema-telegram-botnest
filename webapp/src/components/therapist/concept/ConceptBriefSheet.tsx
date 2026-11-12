import { useMemo } from 'react';
import { useTr } from '../../../utils/addressForm';
import type { ClientDetail } from '../clientSheetTypes';
import { ConceptFullscreenSheet } from '../ConceptFullscreenSheet';
import { DigestChips } from '../../../../../shared/src/therapy/conceptGraph/DigestChips';
import { hueStyle } from '../../../lib/tone';
import { SignArt } from '../../art/SignArt';
import { modeSign } from '../../art/guideSignsModel';
import { SignChip } from '../../paper/SignChip';
import { BRIEF_LOOK } from './conceptSectionSigns';
import {
  BRIEF_BLOCKS,
  buildConceptBrief,
  type BriefSection,
} from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';
import { useBriefBlocks } from './useBriefBlocks';

export const BRIEF_TITLE = 'Главное';

// Экран «Главное»: самое важное из концептуализации на одном экране — листы выбранных блоков бенто
// (три колонки на компьютере), без прокрутки до фигур и полей. Какие блоки показывать, терапевт
// отмечает чипами под шапкой (выбор запоминается на устройстве — useBriefBlocks). Только чтение; данные те же, что в видах «Схема»
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
        {BRIEF_BLOCKS.map((b) => <SignChip key={b.id} label={b.label} on={ids.includes(b.id)} onToggle={() => toggle(b.id)} />)}
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

// Блок — лист бумаги своей сущности со знаком у подписи (BRIEF_LOOK); потребности — нейтральный лист, цвет несут чипы.
function BriefCard({ section: s }: { section: BriefSection }) {
  const look = BRIEF_LOOK[s.id];
  return (
    <section className={look.hue === undefined ? 'tcp-brief-card tcp-brief-card--plain' : 'pp-paper tcp-brief-card'} style={look.hue === undefined ? undefined : hueStyle(look.hue)} aria-label={s.label}>
      <h3 className="ds-label tcp-brief-label">
        <span className="tcp-sec-signs" aria-hidden="true">{look.signs.map((k) => <SignArt key={k} sign={k} size="row" />)}</span>
        {s.label}
      </h3>
      {s.empty ? (
        <div className="tcp-brief-empty">—</div>
      ) : s.kind === 'chips' ? (
        <DigestChips items={s.items} />
      ) : s.kind === 'modes' ? (
        <ul className="tcp-brief-modes">
          {s.modes.map((m) => (
            <li key={m.modeId} className="tcp-brief-mode">
              <span className="tcp-brief-mode-head">
                <b><SignArt sign={modeSign(m.modeId)} size="nav" />{m.name}</b>
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
