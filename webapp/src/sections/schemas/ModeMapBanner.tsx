import { lazy, Suspense } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { GlyphArrowLeft } from '../../components/exercises/ExScreen';
import { hueStyle } from '../../lib/tone';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SignHero } from '../../components/paper/SignHero';

const ModeMapViewer = lazy(() => import('../../components/ModeMapViewer').then(m => ({ default: m.ModeMapViewer })));

const MODES = ENTITY_LOOK.modes;

/** Баннер «Карта режимов с терапевтом» — виден, только если карты есть: лист неба режимов, знак
 *  режимов крупно с тенью-вырезкой справа (как плитки «Сегодня»), весь лист — тап-цель. */
export function ModeMapBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button className="pp-paper cs-banner" style={hueStyle(MODES.hue)} onClick={onOpen}>
      <span className="cs-banner-text">
        <span className="ds-h3">Карта режимов с терапевтом</span>
        <span className="cs-banner-sub">{count === 1 ? 'Схема того, как режимы развиваются на триггер' : `${count} карты · как режимы развиваются на триггер`}</span>
        <span className="pp-arrow cs-banner-arrow" aria-hidden="true">→</span>
      </span>
      <span className="cs-banner-art" aria-hidden="true"><SignHero sign={MODES.sign} /></span>
    </button>
  );
}

export function MyModeMapSheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <div className="cs-sheet">
      <div className="ds-sheet-head">
        <button type="button" onClick={goBack} className="ds-back"><GlyphArrowLeft /> Назад</button>
        <h2 className="ds-h2">Карта режимов</h2>
      </div>
      <div className="cs-sheet-body">
        <Suspense fallback={null}><ModeMapViewer /></Suspense>
      </div>
    </div>
  );
}
