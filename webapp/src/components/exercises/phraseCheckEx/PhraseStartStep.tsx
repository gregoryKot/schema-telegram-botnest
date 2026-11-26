// Первый шаг разбора: записать фразу дословно (b18). Поле — реплика-лист (pa-field, тень сливы, Literata):
// фраза сразу выглядит сказанной. Номера «01.» колонкой больше нет — ход разбора показывают бусины на листе
// героя. Свободный текст — через кризисный гейт до перехода к приметам (правило №7).
import type { RefObject } from 'react';
import { GlyphArrowRight } from '../ExScreen';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { CrisisCard } from '../../CrisisCard';
import { hueStyle } from '../../../lib/tone';
import { CRITIC_LOOK } from './phraseLook';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { EXERCISE_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';

export function PhraseStartStep({ phrase, setPhrase, fieldRef, onNext }: {
  phrase: string;
  setPhrase: (v: string) => void;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  onNext: () => void;
}) {
  return (
    <>
      <label className="ex2-prompt-label" htmlFor="phrase-check-phrase">Что сказал внутренний голос?</label>
      <p className="ex2-prompt-hint">Дословно, теми же словами. Дальше проверим фразу по девяти приметам.</p>
      <div className="ex2-now" style={hueStyle(CRITIC_LOOK.hue)}>
        <LimitedTextarea
          id="phrase-check-phrase"
          max={EXERCISE_TEXT_MAX}
          ref={fieldRef}
          className="pa-field"
          rows={3}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Например: опять всё завалила, ни на что не гожусь"
        />
      </div>
      {detectCrisisAny(phrase) && <CrisisCard surface="phrase_check" />}
      <div className="ex2-foot">
        <span className="ex2-spacer" />
        <button className="ds-btn" disabled={!phrase.trim()} onClick={onNext}>
          Проверить <GlyphArrowRight />
        </button>
      </div>
    </>
  );
}
