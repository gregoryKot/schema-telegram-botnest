import type { Need } from '../../types';
import { GlyphArrowLeft } from '../exercises/ExScreen';
import { IconBtn, TrackerActions } from './TrackerActions';
import { savedLabel } from './savedLabel';
import '../../styles/sheet-tracker-mobile.css';

/** Шапка трекера на телефоне: закрыть, название с подсказкой жестов, заметка и история справа. */
export function MobileTopbar({
  isBackfill,
  date,
  goBack,
  onOpenNote,
  onOpenHistory,
}: {
  isBackfill: boolean;
  date?: string;
  goBack: () => void;
  onOpenNote?: () => void;
  onOpenHistory?: () => void;
}) {
  return (
    <div className="tkm-bar">
      <div className="tkm-bar-l">
        <IconBtn label="Закрыть" onClick={goBack}>
          <path d="M18 6 6 18M6 6l12 12" />
        </IconBtn>
      </div>
      <div className="tkm-bar-mid">
        <div className="tkm-bar-title">{isBackfill ? `Оценки за ${date}` : 'Трекер потребностей'}</div>
        <div className="tkm-bar-sub">свайп · тап по шкале · +/−</div>
      </div>
      <div className="tkm-bar-r">
        <TrackerActions goBack={goBack} onOpenNote={onOpenNote} onOpenHistory={onOpenHistory} />
      </div>
    </div>
  );
}

/** Низ трекера на телефоне: «Назад» (вторичная) и главное действие шага (заливка акцентом). */
export function MobileFooter({
  idx,
  needs,
  allRated,
  lastSavedAt,
  onPrev,
  onNext,
  onFinish,
  onToEmpty,
}: {
  idx: number;
  needs: Need[];
  allRated: boolean;
  lastSavedAt: Date | null;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onToEmpty: () => void;
}) {
  const hasNext = idx < needs.length - 1;
  const main = allRated
    ? { label: '✓ Готово', onClick: onFinish }
    : hasNext
      ? { label: 'Далее →', onClick: onNext }
      : { label: 'К незаполненным ↩', onClick: onToEmpty };
  return (
    <div className="tkm-foot">
      <div className="tkm-foot-row">
        <button type="button" className="tkm-btn tkm-btn--ghost" onClick={onPrev} disabled={idx === 0}>
          <GlyphArrowLeft /> Назад
        </button>
        <button type="button" className="tkm-btn tkm-btn--main" onClick={main.onClick}>
          {main.label}
        </button>
      </div>
      <div className="tkm-saved">{savedLabel(lastSavedAt)}</div>
    </div>
  );
}
