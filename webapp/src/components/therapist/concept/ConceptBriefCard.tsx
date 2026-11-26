import { DigestChips } from '../../../../../shared/src/therapy/conceptGraph/DigestChips';
import type { BriefSection } from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';
import { hueStyle } from '../../../lib/tone';
import { SignArt } from '../../art/SignArt';
import { modeSign } from '../../art/guideSignsModel';
import { BRIEF_LOOK } from './conceptSectionSigns';

// Блок экрана «Главное» — карточка со знаком раздела у подписи (BRIEF_LOOK). Бумагой — только три листа свободного
// текста (переключение режимов, цели, проблемы), остальные — белые карточки: цветные листы всех блоков спорили друг
// с другом (ревью g11 r1). У режима — знак его группы на плашке бумаги группы; схемы и потребности — чипами «Коротко».
export function ConceptBriefCard({ section: s }: { section: BriefSection }) {
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
                <span className="tcp-brief-mode-sign" style={m.hue === undefined ? undefined : hueStyle(m.hue)} aria-hidden="true"><SignArt sign={modeSign(m.modeId)} size="nav" /></span>
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
