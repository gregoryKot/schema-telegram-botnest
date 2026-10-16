import { lazy, Suspense } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { GlyphArrowLeft } from '../../components/exercises/ExScreen';
import { DIARY_HUE, hueStyle } from '../../lib/tone';

const ModeMapViewer = lazy(() => import('../../components/ModeMapViewer').then(m => ({ default: m.ModeMapViewer })));

/** Баннер «Карта режимов с терапевтом» — виден, только если карты есть. */
export function ModeMapBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button className="cs-banner tone-tint" style={hueStyle(DIARY_HUE.mode)} onClick={onOpen}>
      <span className="cs-banner-text">
        <span className="ds-h3">Карта режимов с терапевтом</span>
        <span className="cs-banner-sub">
          {count === 1 ? 'Схема того, как режимы развиваются на триггер' : `${count} карты · как режимы развиваются на триггер`}
        </span>
      </span>
      <span className="cs-banner-arrow">→</span>
    </button>
  );
}

export function MyModeMapSheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <div className="cs-sheet">
      <div className="cs-sheet-head">
        <button onClick={goBack} aria-label="Назад" className="cs-sheet-back"><GlyphArrowLeft /></button>
        <span className="ds-h3">Карта режимов</span>
      </div>
      <div className="cs-sheet-body">
        <Suspense fallback={null}><ModeMapViewer /></Suspense>
      </div>
    </div>
  );
}
