import { useState, useEffect, useRef, type ReactNode } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphArrowLeft, GlyphArrowRight, GlyphCheck } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { buildSideHints } from './beliefCheck/sideHints';
import { EviList } from './beliefCheck/EviList';
import { BeliefDoneScreen } from './beliefCheck/BeliefDoneScreen';
import { BeliefScales } from './beliefCheck/BeliefScales';
import { BeliefProgress, BeliefHint, BeliefRecap } from './beliefCheck/BeliefParts';
import { DiaryStepQ } from '../diary/DiaryStepCard';
import { PaperAlert } from '../paper/PaperAlert';
import { useTr } from '../../utils/addressForm';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { useBeliefCheckForm } from '../../../../shared/src/beliefCheck/useBeliefCheckForm';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { EXERCISE_TEXT_MAX } from '../../../../shared/src/limits/textLimits';

// «Проверка убеждения» (редизайн 2026-11, APP_2026-11.md, b17): лист-герой соломы со знаком Scales
// разворотом — со второго шага знак живой: камешков на чашах столько, сколько доказательств «за» и
// «против» (BeliefScales); шаги — полосками, как мастер дневника; подсказка шага — свёрнутой строкой
// на телефоне. Поля и кризисная детекция — здесь (правило №7), части без полей — beliefCheck/*.
const STEPS = ['Убеждение', 'Доказательства за', 'Доказательства против', 'Переформулировка'];
const HUE = ENTITY_LOOK.belief_check.hue;

export function BeliefCheckEx({ onBack, onComplete }: { onBack: () => void; onComplete?: () => void }) {
  const tr = useTr();
  const SIDE_HINTS = buildSideHints(tr);
  const goBack = useHistorySheet(onBack);
  const form = useBeliefCheckForm(); // текст и шаг живут в черновике: F5 и «Назад» их не стирают
  const { step, setStep, belief, setBelief, forList, setForList, againstList, setAgainstList } = form;
  const { reframe, setReframe, forInput, setForInput, againstInput, setAgainstInput, addFor, addAgainst } = form;
  const [done, setDone] = useState(false); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState(false); // createBeliefCheck раньше глотало отказ и всё равно показывало «Готово»
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.getBeliefChecks>>>([]);
  const beliefRef = useRef<HTMLTextAreaElement>(null);
  const reframeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === 0) beliefRef.current?.focus();
    else if (step === 3) reframeRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (done) api.getBeliefChecks().then((h) => setHistory(h.slice(0, 4))).catch(() => {});
  }, [done]);

  const completed = [belief.trim() ? 0 : -1, forList.length > 0 ? 1 : -1, againstList.length > 0 ? 2 : -1, reframe.trim() ? 3 : -1].filter((x) => x >= 0);

  // Текст в поле, не добавленный «+», — тоже доказательство: любой переход шага
  // (кнопки и полоса шагов) дописывает его в список, а не теряет молча.
  function goTo(n: number) { addFor(); addAgainst(); setStep(n); }

  async function saveAll() {
    setSaving(true); setSaveError(false);
    try {
      await api.createBeliefCheck({ belief, evidenceFor: forList, evidenceAgainst: againstList, reframe });
      form.clearDraft();
      onComplete?.();
      setDone(true);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  if (done) {
    return (
      <BeliefDoneScreen goBack={goBack} belief={belief} forList={forList} againstList={againstList} reframe={reframe}
        history={history} pastChecks={history.filter((h) => h.belief !== belief).slice(0, 3)} onRestart={() => { setDone(false); form.reset(); }} />
    );
  }

  const foot = (next: ReactNode, back?: number) => (
    <div className="ex2-foot">
      {back !== undefined && <button className="ds-btn ex2-ghost" onClick={() => goTo(back)}><GlyphArrowLeft /> Назад</button>}
      <span className="ex2-spacer" />
      {next}
    </div>
  );
  const nextTo = (n: number, label: string, disabled: boolean) => (
    <button className="ds-btn" disabled={disabled} onClick={() => goTo(n)}>{label} <GlyphArrowRight /></button>
  );
  const quoted = (verb: string) => <>{verb} «<em className="ex2-belief-quote">{belief}</em>»?</>;
  return (
    <ExScreen
      onBack={goBack} caution={step === 0} look="belief_check" spread compact={step > 0}
      eyebrow={exerciseCard('belief').eyebrow} title="Проверка убеждения"
      lede={step === 0 ? tr('Поставь одну мысль перед судом фактов. Что её подтверждает, что опровергает, и как сформулировать точнее.', 'Поставьте одну мысль перед судом фактов. Что её подтверждает, что опровергает, и как сформулировать точнее.') : undefined}
      heroArt={step > 0 ? <BeliefScales left={forList.length} right={againstList.length} /> : undefined}
      aside={<BeliefHint key={step} hint={SIDE_HINTS[step]} />}
    >
      <div className="ex2-belief">
        <BeliefProgress steps={STEPS} step={step} completed={completed} hue={HUE} onJump={goTo} />
        {step === 0 && (<>
          <DiaryStepQ title={tr('Запиши мысль, которую хочешь проверить', 'Запишите мысль, которую хотите проверить')} hint="Одно убеждение за раз. Та самая фраза, которая повторяется в голове." />
          <LimitedTextarea max={EXERCISE_TEXT_MAX} ref={beliefRef} className="ds-textarea sd-area" rows={3} value={belief}
            onChange={(e) => setBelief(e.target.value)} placeholder="Например: я всегда всё порчу, меня никто не любит…" />
          {detectCrisisAny(belief) && <CrisisCard surface="belief_check" />}
          {foot(nextTo(1, 'Дальше · доказательства за', !belief.trim()))}
        </>)}
        {step === 1 && (<>
          <DiaryStepQ title={quoted('Что подтверждает')} hint={tr('Записывай честно. Не убеждай себя, что мысль не имеет оснований — она их имеет.', 'Записывайте честно. Не убеждайте себя, что мысль не имеет оснований — она их имеет.')} />
          <EviList side="for" items={forList} setItems={setForList} input={forInput} onInput={setForInput} onAdd={addFor} placeholder="Добавить доказательство…" />
          {detectCrisisAny(forInput, ...forList) && <CrisisCard surface="belief_check" />}
          {foot(nextTo(2, 'Дальше · доказательства против', forList.length === 0 && !forInput.trim()), 0)}
        </>)}
        {step === 2 && (<>
          <DiaryStepQ title={quoted('Что опровергает')} hint={tr('Вспомни факты, исключения, другие точки зрения. Что сказал бы хороший друг?', 'Вспомните факты, исключения, другие точки зрения. Что сказал бы хороший друг?')} />
          <EviList side="against" items={againstList} setItems={setAgainstList} input={againstInput} onInput={setAgainstInput} onAdd={addAgainst} placeholder="Добавить контр-доказательство…" />
          {detectCrisisAny(againstInput, ...againstList) && <CrisisCard surface="belief_check" />}
          {foot(nextTo(3, 'Дальше · переформулировка', againstList.length === 0 && !againstInput.trim()), 1)}
        </>)}
        {step === 3 && (<>
          <DiaryStepQ title="Как можно сформулировать точнее?" hint={tr('Не «всё хорошо». А: что из мысли правда, что преувеличено, и что ты на самом деле сейчас знаешь.', 'Не «всё хорошо». А: что из мысли правда, что преувеличено, и что вы на самом деле сейчас знаете.')} />
          <BeliefRecap forList={forList} againstList={againstList} />
          <LimitedTextarea max={EXERCISE_TEXT_MAX} ref={reframeRef} className="ds-textarea ex2-reframe" rows={5} value={reframe}
            onChange={(e) => setReframe(e.target.value)} placeholder="Иногда я действительно ошибаюсь, но это не значит что я всегда всё порчу…" />
          {detectCrisisAny(reframe) && <CrisisCard surface="belief_check" />}
          {saveError && <PaperAlert sign="scales" title={tr('Не удалось сохранить. Проверь связь и попробуй ещё раз.', 'Не удалось сохранить. Проверьте связь и попробуйте ещё раз.')} />}
          {foot(<button className="ds-btn" disabled={!reframe.trim() || saving} onClick={saveAll}>{saving ? 'Сохраняю…' : <>Сохранить и закрыть <GlyphCheck /></>}</button>, 2)}
        </>)}
      </div>
    </ExScreen>
  );
}
