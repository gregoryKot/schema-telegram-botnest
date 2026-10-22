import { TherapyNote } from '../TherapyNote';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { hueStyle } from '../../lib/tone';
import { FlashcardFrame, FlashcardStepHead, FlashcardProgress } from './FlashcardFrame';
import { flashcardModeHue, flashcardNeedHue } from './flashcardTone';
import type { ModeData, NeedData } from '../schemaFlashcard/types';

type Tr = (ty: string, vy: string) => string;
interface Common { stepIndex: number; total: number; onBack: () => void; backLabel: string }

/** Шаг 1: что сейчас активно. */
export function StepMode({ modes, hasHistory, onHistory, onPick, ...c }: Common & {
  modes: ModeData[]; hasHistory: boolean; onHistory: () => void; onPick: (id: string) => void;
}) {
  return (
    <FlashcardFrame onBack={c.onBack} label={c.backLabel}>
      <div className="sk-fc-headrow">
        <FlashcardStepHead n={1} title="Что сейчас активно?" />
        {hasHistory && <button onClick={onHistory} className="ds-btn ds-btn--sm ds-btn--secondary">История</button>}
      </div>
      <FlashcardProgress total={c.total} index={c.stepIndex} />
      <div className="sk-list">
        {modes.map(m => (
          <button key={m.id} onClick={() => onPick(m.id)} className="ds-card ds-card--hover sk-fc-choice">
            <span className="sk-fc-choice-top">
              <span className="ds-dot tone-fill" style={hueStyle(flashcardModeHue(m.id))} />
              <span className="ds-h3 tone-ink" style={hueStyle(flashcardModeHue(m.id))}>{m.label}</span>
            </span>
            <span className="sk-fc-choice-desc">{m.desc}</span>
          </button>
        ))}
      </div>
      <div className="sk-fc-note"><TherapyNote compact /></div>
    </FlashcardFrame>
  );
}

/** Шаг 2: ответ Здорового Взрослого + необязательная рефлексия. */
export function StepResponse({ tr, response, reflection, setReflection, onNext, ...c }: Common & {
  tr: Tr; response?: string; reflection: string; setReflection: (v: string) => void; onNext: () => void;
}) {
  return (
    <FlashcardFrame onBack={c.onBack} label={c.backLabel}>
      <FlashcardStepHead n={2} title="Здоровый Взрослый" />
      <FlashcardProgress total={c.total} index={c.stepIndex} />
      <div className="ds-card sk-fc-voice tone-soft" style={hueStyle(145)}>
        <div className="ds-eyebrow tone-ink">{tr('Говорит тебе', 'Говорит вам')}</div>
        <p className="sk-fc-voice-text">{response}</p>
      </div>
      <div className="sk-fc-ask">
        Что отзывается? <span className="ds-sub">(необязательно)</span>
      </div>
      <textarea
        value={reflection}
        onChange={e => setReflection(e.target.value)}
        placeholder="Что хочется сказать себе..."
        rows={3}
        className="ds-textarea"
      />
      {detectCrisisAny(reflection) && <CrisisCard surface="flashcard" />}
      <button onClick={onNext} className="ds-btn sk-fc-wide">Дальше →</button>
      <div className="sk-fc-note"><TherapyNote compact /></div>
    </FlashcardFrame>
  );
}

/** Шаг 3: какая потребность не удовлетворена. */
export function StepNeed({ needs, selected, onPick, ...c }: Common & {
  needs: NeedData[]; selected: string | null; onPick: (id: string) => void;
}) {
  return (
    <FlashcardFrame onBack={c.onBack} label={c.backLabel}>
      <FlashcardStepHead n={3} title="Что за этим стоит?" />
      <FlashcardProgress total={c.total} index={c.stepIndex} />
      <p className="sk-fc-ask">Какая потребность сейчас не удовлетворена?</p>
      <div className="sk-list">
        {needs.map(n => (
          <button key={n.id} onClick={() => onPick(n.id)}
            className={'ds-card ds-card--row ds-card--hover sk-fc-need' + (selected === n.id ? ' is-selected' : '')}>
            <span className="ds-dot tone-fill" style={hueStyle(flashcardNeedHue(n.id))} />
            <span className="ds-h3">{n.label}</span>
          </button>
        ))}
      </div>
      <div className="sk-fc-note"><TherapyNote compact /></div>
    </FlashcardFrame>
  );
}

/** Шаг 4: один маленький шаг. */
export function StepAction({ tr, need, action, setAction, onSave, ...c }: Common & {
  tr: Tr; need?: NeedData; action: string; setAction: (v: string) => void; onSave: () => void;
}) {
  return (
    <FlashcardFrame onBack={c.onBack} label={c.backLabel}>
      <FlashcardStepHead n={4} title="Один маленький шаг" />
      <FlashcardProgress total={c.total} index={c.stepIndex} />
      {need && (
        <div className="ds-card ds-card--row sk-fc-need-card">
          <span className="ds-dot tone-fill" style={hueStyle(flashcardNeedHue(need.id))} />
          <div>
            <div className="ds-label">Потребность</div>
            <div className="ds-h3">{need.label}</div>
          </div>
        </div>
      )}
      <p className="sk-fc-ask">
        {tr('Что одно маленькое действие ты можешь сделать прямо сейчас?', 'Что одно маленькое действие вы можете сделать прямо сейчас?')}
      </p>
      <textarea
        value={action}
        onChange={e => setAction(e.target.value)}
        placeholder="Написать другу, выйти подышать, обнять подушку..."
        rows={3}
        className="ds-textarea"
      />
      {detectCrisisAny(action) && <CrisisCard surface="flashcard" />}
      <button onClick={onSave} disabled={!action.trim()} className="ds-btn sk-fc-wide">Сохранить</button>
      <div className="sk-fc-note"><TherapyNote compact /></div>
    </FlashcardFrame>
  );
}
