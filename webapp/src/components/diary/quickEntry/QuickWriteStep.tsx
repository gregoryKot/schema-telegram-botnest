import { useEffect, useRef } from 'react';
import { haptic } from '../../../haptic';
import { CrisisCard } from '../../CrisisCard';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../../shared/src/limits/textLimits';
import { QUICK_TAGS, hasSecondStep, type QuickTag } from './quickEntryModel';
import type { QuickError } from './useQuickEntry';

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

/** Первый экран «Дневника одной страницей»: поле «Что на уме?», необязательный тег, «Сохранить». */
export function QuickWriteStep({ text, tag, saving, error, onText, onTag, onSubmit, onDetailed, onClose }: Props) {
  // Правило №7: детекция прямо в файле с полем ввода (трипваер crisis-path.invariants).
  const crisis = detectCrisisAny(text);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { areaRef.current?.focus(); }, []);
  return (
    <>
      <div className="tq-bar">
        <button type="button" className="tq-bar-btn" onClick={onClose}>Закрыть</button>
        <span className="ds-eyebrow qe-bar-title">Дневник</span>
        <span />
      </div>
      <div className="tq-body">
        <div className="tq-inner">
          <h1 className="tq-title">Что на уме?</h1>
          <LimitedTextarea
            max={DIARY_FIELD_MAX}
            ref={areaRef}
            className="qe-area"
            value={text}
            onChange={(e) => onText(e.target.value)}
            placeholder="Можно одним предложением. Можно без точки."
            aria-label="Что на уме?"
          />
          {crisis && <CrisisCard surface="schema" />}
          <div className="qe-tags" role="radiogroup" aria-label="Тег записи">
            {QUICK_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tag === t.id}
                className={'qe-tag' + (tag === t.id ? ' is-active' : '')}
                onClick={() => { haptic.select(); onTag(t.id); }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="tq-hint">Тег необязателен. Схему или режим можно уточнить на следующем шаге.</p>
          <button type="button" className="tq-more" onClick={onDetailed}>Заполнить подробно →</button>
          {error === 'failed' && (
            <p role="alert" className="qe-error">Не удалось сохранить. Текст остался на месте — можно повторить.</p>
          )}
          {error === 'gratitudeFull' && (
            <p role="alert" className="qe-error">
              На сегодня уже пять пунктов.{' '}
              <button type="button" className="qe-error-act" onClick={() => onTag('thought')}>Записать как мысль</button>
            </p>
          )}
          <button type="button" className="ds-btn qe-cta" disabled={!text.trim() || saving} onClick={onSubmit}>
            {saving ? 'Сохраняю…' : hasSecondStep(tag) ? 'Дальше' : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
}
