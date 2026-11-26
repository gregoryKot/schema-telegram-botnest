import { useState } from 'react';

/** Состояние карточки схемы или режима на экране упражнения (SchemaEx/ModeEx): номер вопроса
 *  (лист-герой со второго — компактнее), «готово» и написанное. После сохранения написанное
 *  становится стартом формы: «Изменить карточку» открывает вопросы с ним, без второго запроса
 *  (SavedNoteGate preset), а не пустыми — пустая форма затёрла бы карточку (INCIDENTS, 2026-10-31).
 *  Другая схема или режим — `reset`: написанное грузится заново, с первого вопроса. */
export function useCardFlow(initialData?: Record<string, string>) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initialData);
  const [done, setDone] = useState(false);
  return {
    step, setStep, values, done,
    saved: (data: Record<string, string>) => { setValues(data); setDone(true); },
    edit: () => { setDone(false); setStep(0); },
    reset: () => { setValues(undefined); setDone(false); setStep(0); },
  };
}
