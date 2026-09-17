// Состояние мастера «Критик или забота?» — общее для обоих фронтендов
// (правило №3 CLAUDE.md). Раньше жило только в мини-аппе и было продублировано
// один-в-один при переносе упражнения на сайт (jscpd поймал восемь идентичных
// useState + функцию answer()) — вынесено сюда, чтобы новое поле стейта не
// рассинхронизировалось между копиями. done/saving/saveError/history остаются
// у каждого фронтенда локально: у миниаппа и сайта разное поведение при
// отказе сохранения (миниапп — оптимистичный переход на done с пометкой об
// ошибке, сайт — блокирующее сохранение, как в остальных ex-упражнениях), это
// не состояние формы, а разная политика UX.
import { useState, type Dispatch, type SetStateAction } from 'react';
import { type PhraseMarkId } from './criteria';

export interface PhraseCheckState {
  phrase: string;
  setPhrase: (v: string) => void;
  /** -1 — ещё на вводе фразы, 0..8 — приметы, 9 — переписать */
  markIndex: number;
  setMarkIndex: Dispatch<SetStateAction<number>>;
  marks: PhraseMarkId[];
  rewrite: string;
  setRewrite: (v: string) => void;
  /** Переписанную фразу предлагаем забрать в «Тёплые слова» — можно снять. */
  inWarmWords: boolean;
  setInWarmWords: (v: boolean) => void;
  /** critic=true — примета засчитана как голос критика, переход к следующей. */
  answer: (id: PhraseMarkId, critic: boolean) => void;
  /** Полный сброс к начальному состоянию — «проверить ещё одну» (webapp). */
  reset: () => void;
}

export function usePhraseCheckState(): PhraseCheckState {
  const [phrase, setPhrase] = useState('');
  const [markIndex, setMarkIndex] = useState(-1);
  const [marks, setMarks] = useState<PhraseMarkId[]>([]);
  const [rewrite, setRewrite] = useState('');
  const [inWarmWords, setInWarmWords] = useState(true);

  function answer(id: PhraseMarkId, critic: boolean) {
    if (critic) setMarks((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setMarkIndex((i) => i + 1);
  }

  function reset() {
    setPhrase('');
    setMarkIndex(-1);
    setMarks([]);
    setRewrite('');
    setInWarmWords(true);
  }

  return {
    phrase,
    setPhrase,
    markIndex,
    setMarkIndex,
    marks,
    rewrite,
    setRewrite,
    inWarmWords,
    setInWarmWords,
    answer,
    reset,
  };
}
