// Четыре шага «Мне плохо» (порядок шагов и тексты не меняются — кризисный путь). Вид (b12): шапка — лист «Мне плохо»
// с «Шаг N из 4» и полосой (FlashcardStepHead), без огромной цифры; ответы — плитки бумаги группы режима со знаком группы
// (ChildCare, Flare, Shelter, Looming) и бумаги потребности с NeedArt — языком «Моих паттернов»; голос Здорового Взрослого —
// лист мха со знаком Together; поле — общий поле-лист. Кризисная карточка шага — с Heart; на ≥1024 рядом Heart героя шага,
// и знак карточки гасит тот же @media, что показывает героя (flashcard.css; ревью g4 r5, r6 — на телефоне знак на месте).
import type { CSSProperties } from 'react';
import { TherapyNote } from '../TherapyNote';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { SignArt } from '../art/SignArt';
import { SignHero } from '../paper/SignHero';
import { FlashcardFrame, FlashcardStepHead } from './FlashcardFrame';
import { flashcardModeLook, flashcardNeedLook } from './flashcardLook';
import type { ModeData, NeedData } from '../schemaFlashcard/types';
import { modeGroupLook } from '../../../../shared/src/theme/entityLook';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { EXERCISE_TEXT_MAX } from '../../../../shared/src/limits/textLimits';
import { glue } from '../../../../shared/src/utils/typo';

type Tr = (ty: string, vy: string) => string;
interface Common { stepIndex: number; total: number; onBack: () => void; backLabel: string }

const paper = (hue: number | undefined) => (hue === undefined ? undefined : ({ '--h': hue } as CSSProperties));
/** Голос Здорового Взрослого — бумага и знак здоровых режимов (мох 145, Together). */
const HEALTHY = modeGroupLook('healthy');

/** Шаг 1: что сейчас активно. */
export function StepMode({ modes, hasHistory, onHistory, onPick, ...c }: Common & {
  modes: ModeData[]; hasHistory: boolean; onHistory: () => void; onPick: (id: string) => void;
}) {
  const history = hasHistory ? <button onClick={onHistory} className="ds-link pa-quiet">История</button> : undefined;
  return (
    <FlashcardFrame onBack={c.onBack} label={c.backLabel} aside={history}
      side={<FlashcardStepHead n={c.stepIndex + 1} total={c.total} title="Что сейчас активно?" />}>
      <div className="sk-fc-tiles">
        {modes.map(m => {
          const look = flashcardModeLook(m.id);
          return (
            <button key={m.id} onClick={() => onPick(m.id)} className="pp-paper sk-fc-choice" style={paper(look.hue)}>
              <span className="sk-fc-choice-sign" aria-hidden="true"><SignHero sign={look.sign} /></span>
              <span className="sk-fc-choice-title">{m.label}</span>
              <span className="sk-fc-choice-desc">{m.desc}</span>
            </button>
          );
        })}
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
    <FlashcardFrame onBack={c.onBack} label={c.backLabel}
      side={<FlashcardStepHead n={c.stepIndex + 1} total={c.total} title="Здоровый Взрослый" />}>
      <div className="pp-paper sk-fc-voice" style={paper(HEALTHY.hue)}>
        <span className="sk-fc-voice-sign" aria-hidden="true"><SignHero sign={HEALTHY.sign} /></span>
        <div className="ds-label sk-fc-voice-label">{tr('Говорит тебе', 'Говорит вам')}</div>
        <p className="sk-fc-voice-text">{response && glue(response)}</p>
      </div>
      <div className="sk-fc-ask">
        Что отзывается? <span className="sk-fc-ask-opt">(необязательно)</span>
      </div>
      <LimitedTextarea
        max={EXERCISE_TEXT_MAX}
        value={reflection}
        onChange={e => setReflection(e.target.value)}
        placeholder="Что хочется сказать себе…"
        rows={3}
        className="pa-field sk-fc-field"
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
    <FlashcardFrame onBack={c.onBack} label={c.backLabel}
      side={<FlashcardStepHead n={c.stepIndex + 1} total={c.total} title="Что за этим стоит?" />}>
      <p className="sk-fc-ask">{glue('Какая потребность сейчас не удовлетворена?')}</p>
      <div className="sk-fc-tiles sk-fc-tiles--needs">
        {needs.map(n => {
          const look = flashcardNeedLook(n.id);
          return (
            <button key={n.id} onClick={() => onPick(n.id)} aria-pressed={selected === n.id}
              className={'pp-paper sk-fc-need' + (selected === n.id ? ' is-selected' : '')} style={paper(look?.hue)}>
              <span className="sk-fc-need-sign" aria-hidden="true">{look && <SignArt sign={look.sign} size="square" />}</span>
              <span className="sk-fc-need-title">{n.label}</span>
            </button>
          );
        })}
      </div>
      <div className="sk-fc-note"><TherapyNote compact /></div>
    </FlashcardFrame>
  );
}

/** Шаг 4: один маленький шаг. */
export function StepAction({ tr, need, action, setAction, onSave, ...c }: Common & {
  tr: Tr; need?: NeedData; action: string; setAction: (v: string) => void; onSave: () => void;
}) {
  const look = need ? flashcardNeedLook(need.id) : null;
  return (
    <FlashcardFrame onBack={c.onBack} label={c.backLabel}
      side={<FlashcardStepHead n={c.stepIndex + 1} total={c.total} title="Один маленький шаг" />}>
      {need && (
        <div className="pp-paper sk-fc-need-card" style={paper(look?.hue)}>
          <span className="sk-fc-need-sign" aria-hidden="true">{look && <SignArt sign={look.sign} size="square" />}</span>
          <div>
            <div className="ds-label sk-fc-need-label">Потребность</div>
            <div className="sk-fc-need-title">{need.label}</div>
          </div>
        </div>
      )}
      <p className="sk-fc-ask">
        {glue(tr('Что одно маленькое действие ты можешь сделать прямо сейчас?', 'Что одно маленькое действие вы можете сделать прямо сейчас?'))}
      </p>
      <LimitedTextarea
        max={EXERCISE_TEXT_MAX}
        value={action}
        onChange={e => setAction(e.target.value)}
        placeholder="Написать другу, выйти подышать, обнять подушку…"
        rows={3}
        className="pa-field sk-fc-field"
      />
      {detectCrisisAny(action) && <CrisisCard surface="flashcard" />}
      <button onClick={onSave} disabled={!action.trim()} className="ds-btn sk-fc-wide">Сохранить</button>
      <div className="sk-fc-note"><TherapyNote compact /></div>
    </FlashcardFrame>
  );
}
