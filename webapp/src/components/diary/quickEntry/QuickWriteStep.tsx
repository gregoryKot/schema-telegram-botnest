import { useEffect, useRef } from 'react';
import { CrisisCard } from '../../CrisisCard';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../../shared/src/limits/textLimits';
import { EntitySheet } from '../../paper/EntitySheet';
import { PaperAlert } from '../../paper/PaperAlert';
import { hasSecondStep, type QuickTag } from './quickEntryModel';
import { QuickTagChips } from './QuickTagChips';
import type { QuickError } from './useQuickEntry';
import { unwritableGratitudeText } from '../../../../../shared/src/api/unwritableError';
import { useTr } from '../../../utils/addressForm';
import { glue } from '../../../../../shared/src/utils/typo';

interface Props {
  text: string;
  tag: QuickTag;
  saving: boolean;
  error: QuickError | null;
  onText: (v: string) => void;
  onTag: (t: QuickTag) => void;
  onSubmit: () => void;
  onDetailed: () => void;
  onClose: () => void;
}

/**
 * Первый экран «Дневника одной страницей»: лист персика (плитка «Дневник» на главной) с Pebbles,
 * на нём белый лист поля — без контура, тень сплошным слоем, фокус мягким кольцом (quick-entry.css).
 * Под листом — теги со знаком типа записи, «Сохранить» и тихая ссылка «Заполнить подробно».
 */
export function QuickWriteStep({ text, tag, saving, error, onText, onTag, onSubmit, onDetailed, onClose }: Props) {
  const tr = useTr();
  // Правило №7: детекция прямо в файле с полем ввода (трипваер crisis-path.invariants).
  const crisis = detectCrisisAny(text);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { areaRef.current?.focus(); }, []);
  return (
    <>
      <div className="tq-bar">
        <button type="button" className="tq-bar-btn" onClick={onClose}>Закрыть</button>
        <span />
        <span />
      </div>
      <div className="tq-body">
        <div className="qe-flow">
          <EntitySheet look="diary" label="Дневник" title="Что на уме?" titleAs="h1" className="qe-sheet">
            <div className="qe-page">
              <LimitedTextarea
                max={DIARY_FIELD_MAX}
                ref={areaRef}
                className="pa-field qe-area"
                value={text}
                onChange={(e) => onText(e.target.value)}
                placeholder="Можно одним предложением. Можно без точки."
                aria-label="Что на уме?"
              />
            </div>
          </EntitySheet>
          {crisis && <CrisisCard surface="schema" />}
          <div className="qe-foot">
            <div className="qe-foot-main">
              <QuickTagChips tag={tag} onTag={onTag} />
              <p className="tq-hint qe-hint">{glue('Тег необязателен. Схему или режим можно уточнить на следующем шаге.')}</p>
              {error === 'failed' && (
                <PaperAlert sign="pebbles" title="Не удалось сохранить." text="Текст остался на месте — можно повторить." />
              )}
              {(error === 'gratitudeFull' || error === 'unreadable') && (
                <PaperAlert sign="pebbles"
                  title={error === 'gratitudeFull' ? 'На сегодня уже пять пунктов.' : unwritableGratitudeText(tr)}
                  onRetry={() => onTag('thought')} retryLabel="Записать как мысль" />
              )}
            </div>
            <div className="qe-acts qe-acts--row">
              <button type="button" className="ds-btn qe-cta" disabled={!text.trim() || saving}
                aria-busy={saving || undefined} onClick={onSubmit}>
                {saving ? 'Сохраняю…' : hasSecondStep(tag) ? 'Дальше' : 'Сохранить'}
              </button>
              <button type="button" className="tq-more qe-more" onClick={onDetailed}>Заполнить подробно →</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
