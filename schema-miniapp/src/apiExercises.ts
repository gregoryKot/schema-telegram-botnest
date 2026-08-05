// Инструменты дневника в одном месте: проверка убеждения, разбор фразы,
// письма, безопасное место, флешкарты. Вынесено из api.ts (правило №10 —
// файл на 441 строке не пухнет дальше); поведение методов не менялось,
// добавлены только phrase-checks.
import { get, post, del } from './apiClient';
import type { PhraseMarkId } from '../../shared/src/phraseCheck/criteria';

export interface PhraseCheckEntry {
  id: number;
  phrase: string;
  marks: PhraseMarkId[];
  rewrite: string | null;
  /** Забрана ли переписанная фраза в «Тёплые слова» */
  inWarmWords: boolean;
  createdAt: string;
}

export const exercisesApi = {
  // ─── Exercises ───────────────────────────────────────────────────────────────
  getBeliefChecks: () =>
    get<
      Array<{
        id: number;
        belief: string;
        evidenceFor: string[];
        evidenceAgainst: string[];
        reframe: string | null;
        createdAt: string;
      }>
    >('/api/belief-checks'),
  createBeliefCheck: (body: {
    belief: string;
    evidenceFor: string[];
    evidenceAgainst: string[];
    reframe?: string;
  }) => post('/api/belief-checks', body),
  deleteBeliefCheck: (id: number) => del(`/api/belief-checks/${id}`),

  getLetters: () =>
    get<Array<{ id: number; text: string; createdAt: string }>>('/api/letters'),
  createLetter: (text: string) => post('/api/letters', { text }),
  deleteLetter: (id: number) => del(`/api/letters/${id}`),

  getSafePlace: () =>
    get<{ description: string; updatedAt: string } | null>('/api/safe-place'),
  saveSafePlace: (description: string) =>
    post('/api/safe-place', { description }),

  getFlashcards: () =>
    get<
      Array<{
        id: number;
        modeId: string;
        needId: string;
        reflection: string | null;
        action: string | null;
        createdAt: string;
      }>
    >('/api/flashcards'),
  createFlashcard: (body: {
    modeId: string;
    needId: string;
    reflection?: string;
    action?: string;
  }) => post('/api/flashcards', body),
  deleteFlashcard: (id: number) => del(`/api/flashcards/${id}`),

  // ─── Разбор фразы критика ────────────────────────────────────────────────────
  getPhraseChecks: () => get<PhraseCheckEntry[]>('/api/phrase-checks'),
  createPhraseCheck: (body: {
    phrase: string;
    marks: PhraseMarkId[];
    rewrite?: string;
    inWarmWords?: boolean;
  }) => post('/api/phrase-checks', body),
  deletePhraseCheck: (id: number) => del(`/api/phrase-checks/${id}`),
};
