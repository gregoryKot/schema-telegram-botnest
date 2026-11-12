import { useState, useRef, useEffect } from 'react';
import { GlyphArrowLeft, GlyphArrowRight, GlyphCheck } from '../ExGlyphs';
import { useSavingAction } from '../../../hooks/useSavingAction';
import { useTr } from '../../../utils/addressForm';
import { DiaryTicks, DiaryStepQ } from '../../diary/DiaryStepCard';
import { hueStyle } from '../../../lib/tone';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { CrisisCard } from '../../CrisisCard';
import { PaperAlert } from '../../paper/PaperAlert';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { NOTE_CARD_FIELD_MAX } from '../../../../../shared/src/limits/textLimits';
import type { Q } from '../flashcardQuestions';
import type { SignKey } from '../../../../../shared/src/theme/entityLook';

// Вопросы карточки схемы или режима (SchemaEx/ModeEx): полоски вопросов тоном домена или группы,
// вопрос на бумаге страницы — цветная бумага у листа-героя над ним (APP_2026-11.md, принцип 4):
// та же раскладка шага, что у мастера дневника (DiaryTicks, DiaryStepQ, sd-step*), свои подписи.
// Шаг держит экран: лист-герой со второго вопроса компактнее.
// Аудит 2026-08-22 (находка №2): сохранение с состоянием отправки, защитой от двойного нажатия
// и видимым сбоем — человек должен понимать, приняли ли нажатие.
export function CardQuestions({ questions, hue, sign, step, onStep, initial, onSave, onSaved }: {
  questions: Q[]; hue: number; step: number; onStep: (n: number) => void;
  /** Знак карточки у сбоя сохранения — тот же, что у сбоя загрузки (SavedNoteGate): Layers или Cluster. */
  sign: SignKey;
  initial?: Record<string, string>;
  onSave: (data: Record<string, string>) => Promise<void>;
  onSaved: (data: Record<string, string>) => void;
}) {
  const tr = useTr();
  const [data, setData] = useState<Record<string, string>>(() => ({ ...Object.fromEntries(questions.map(q => [q.key, ''])), ...initial }));
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { areaRef.current?.focus(); }, []);

  const filled = questions.map(q => !!data[q.key]?.trim());
  const q = questions[step];
  const isLast = step === questions.length - 1;
  const { saving, error, run } = useSavingAction();
  async function handleSave() {
    if (await run(() => onSave(data))) onSaved(data);
  }

  return (<>
    <DiaryTicks unit="Вопрос" filled={filled} active={step} hue={hue} onJump={onStep} />
    <section className="sd-step" style={hueStyle(hue)}>
      <div className="sd-step-head">
        <span className="ds-label sd-step-n">Вопрос {step + 1} из {questions.length}</span>
        {q.optional && <span className="sd-step-flag">· можно пропустить</span>}
        <span className="sd-step-count">{filled.filter(x => x).length} / {questions.length} заполнено</span>
      </div>
      <DiaryStepQ title={q.label} hint={q.hint} />
      <LimitedTextarea max={NOTE_CARD_FIELD_MAX} ref={areaRef} className="ds-textarea sd-area" rows={5} value={data[q.key]} onChange={e => setData(d => ({ ...d, [q.key]: e.target.value }))} placeholder={q.placeholder} />
    </section>
    {detectCrisisAny(...Object.values(data)) && <CrisisCard surface="flashcard" />}
    {isLast && error && <PaperAlert sign={sign} title={tr('Не удалось сохранить. Проверь связь и попробуй ещё раз', 'Не удалось сохранить. Проверьте связь и попробуйте ещё раз')} />}
    <div className="ex2-foot">
      <button className="ds-btn ex2-ghost" disabled={step === 0} onClick={() => onStep(Math.max(0, step - 1))}><GlyphArrowLeft /> Назад</button>
      <span className="ex2-spacer" />
      {!isLast
        ? <button className="ds-btn" onClick={() => onStep(step + 1)}>{data[q.key]?.trim() ? 'Дальше' : 'Пропустить'} <GlyphArrowRight /></button>
        : <button className="ds-btn" disabled={!filled.some(x => x) || saving} onClick={handleSave}>{saving ? 'Сохраняю…' : <>Сохранить карточку <GlyphCheck /></>}</button>
      }
    </div>
  </>);
}
