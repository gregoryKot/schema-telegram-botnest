// Форма «Проверки убеждения» — общая для сайта (BeliefCheckEx) и мини-аппа
// (BeliefCheck), как usePhraseCheckState у «Критик или забота?». Держит
// убеждение, доказательства, переформулировку и шаг мастера и пишет их в
// черновик (useDraftAutosave): перезагрузка или «Назад» больше не стирают
// разбор (QA 2026-11, З3). Сохранение и экран «готово» — у площадки.
import { useState } from 'react';
import { EXERCISE_DRAFT_KEYS } from '../utils/drafts';
import { restoreDraft, useDraftAutosave } from '../utils/useDraftAutosave';

const KEY = EXERCISE_DRAFT_KEYS.beliefCheck;

export interface BeliefCheckDraft {
  /** 0 — убеждение, 1 — за, 2 — против, 3 — переформулировка. */
  step: number;
  belief: string;
  forList: string[];
  againstList: string[];
  reframe: string;
  forInput: string;
  againstInput: string;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export function useBeliefCheckForm() {
  const [d] = useState(() => restoreDraft<BeliefCheckDraft>(KEY));
  const [step, setStep] = useState(() =>
    typeof d?.step === 'number' && d.step >= 0 && d.step <= 3 ? d.step : 0,
  );
  const [belief, setBelief] = useState(d?.belief ?? '');
  const [forList, setForList] = useState(() => strings(d?.forList));
  const [againstList, setAgainstList] = useState(() => strings(d?.againstList));
  const [reframe, setReframe] = useState(d?.reframe ?? '');
  const [forInput, setForInput] = useState(d?.forInput ?? '');
  const [againstInput, setAgainstInput] = useState(d?.againstInput ?? '');
  const snapshot: BeliefCheckDraft = {
    step,
    belief,
    forList,
    againstList,
    reframe,
    forInput,
    againstInput,
  };
  const clearDraft = useDraftAutosave(KEY, snapshot);

  function addFor() {
    const v = forInput.trim();
    if (!v) return;
    setForList((l) => [...l, v]);
    setForInput('');
  }

  function addAgainst() {
    const v = againstInput.trim();
    if (!v) return;
    setAgainstList((l) => [...l, v]);
    setAgainstInput('');
  }

  /** «Проверить ещё одну»: пустая форма с первого шага (черновик стирается сам). */
  function reset() {
    setStep(0);
    setBelief('');
    setForList([]);
    setAgainstList([]);
    setReframe('');
    setForInput('');
    setAgainstInput('');
  }

  return {
    ...snapshot,
    setStep,
    setBelief,
    setForList,
    setAgainstList,
    setReframe,
    setForInput,
    setAgainstInput,
    addFor,
    addAgainst,
    reset,
    clearDraft,
  };
}
