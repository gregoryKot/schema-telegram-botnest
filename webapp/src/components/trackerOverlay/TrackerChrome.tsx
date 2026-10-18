import type { Need } from '../../types';
import { hueStyle, NEED_HUE } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import { hitboxStyle } from '../../utils/hitbox';
import { GlyphArrowLeft } from '../exercises/ExScreen';

const needHue = (id: string) => NEED_HUE[id as NeedId];

/** Точки-шаги: по одной на потребность, активная — вытянутая в тоне потребности. */
export function TrackerSteps({
  needs,
  idx,
  ratings,
  onPick,
}: {
  needs: Need[];
  idx: number;
  ratings: Record<string, number>;
  onPick: (i: number) => void;
}) {
  return (
    <div className="tk2-steps">
      {needs.map((n, i) => {
        // Зона 24 (не 44): шаг точек 12px, шире соседей перекроют друг друга.
        const hb = hitboxStyle(i === idx ? 22 : 6, 6, 24);
        const state = i === idx ? ' is-active' : (ratings[n.id] ?? 0) > 0 ? ' is-done' : '';
        return (
          <button key={n.id} onClick={() => onPick(i)} aria-label={n.chartLabel} style={hb.outer}>
            <div className={'tk2-step-dot' + state} style={{ ...hb.inner, ...hueStyle(needHue(n.id)) }} />
          </button>
        );
      })}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  const hb = hitboxStyle(30, 30, 44);
  return (
    <button onClick={onClick} aria-label={label} style={hb.outer}>
      <span className="tk2-ico" style={hb.inner}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </svg>
      </span>
    </button>
  );
}

export function TrackerTopbar({
  isBackfill,
  isDesktop,
  date,
  goBack,
  onOpenNote,
  onOpenHistory,
}: {
  isBackfill: boolean;
  isDesktop: boolean;
  date?: string;
  goBack: () => void;
  onOpenNote?: () => void;
  onOpenHistory?: () => void;
}) {
  return (
    <div className="tk2-bar">
      <button onClick={goBack} className="ds-link tk2-back">
        <GlyphArrowLeft /> {isBackfill ? 'Закрыть' : 'Назад'}
      </button>
      {isDesktop && (
        <div className="ds-label tk2-bar-title">{isBackfill ? `Оценки за ${date}` : 'Трекер потребностей'}</div>
      )}
      <div className="tk2-bar-actions">
        {onOpenNote && (
          <IconBtn label="Заметка" onClick={onOpenNote}>
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </IconBtn>
        )}
        {onOpenHistory && (
          <IconBtn
            label="История"
            onClick={() => {
              onOpenHistory();
              goBack();
            }}
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </IconBtn>
        )}
      </div>
    </div>
  );
}

export function TrackerFooter({
  needName,
  idx,
  needs,
  allRated,
  lastSavedAt,
  onPrev,
  onNext,
  onFinish,
  onToEmpty,
}: {
  needName: (n: Need) => string;
  idx: number;
  needs: Need[];
  allRated: boolean;
  lastSavedAt: Date | null;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onToEmpty: () => void;
}) {
  const prevNeed = needs[idx - 1];
  const nextNeed = needs[idx + 1];
  return (
    <div className="tk2-foot">
      <div className="tk2-foot-l">
        <button onClick={onPrev} disabled={idx === 0} className="tk2-prev">
          <span>←</span>
          {prevNeed && <span className="tk2-it"> {needName(prevNeed).toLowerCase()}</span>}
        </button>
      </div>
      <div className="ds-label tk2-foot-mid">
        {lastSavedAt
          ? `сохранено ${lastSavedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          : 'сохранено автоматически'}
      </div>
      <div className="tk2-foot-r">
        {allRated ? (
          <button onClick={onFinish} className="ds-btn ds-btn--sm">
            ✓ Готово
          </button>
        ) : nextNeed ? (
          <button onClick={onNext} className="ds-btn ds-btn--sm">
            <span className="tk2-it">далее: {needName(nextNeed).toLowerCase()}</span>
            <span>→</span>
          </button>
        ) : (
          <button onClick={onToEmpty} className="ds-btn ds-btn--sm ds-btn--secondary">
            К незаполненным ↩
          </button>
        )}
      </div>
    </div>
  );
}
