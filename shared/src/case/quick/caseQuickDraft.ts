/**
 * Черновик потока «Что случилось» (сайт). Свой ключ, не `diary_draft_case`
 * старого потока: у старого другая форма данных (10 шагов, критерий, рамки),
 * и чужой черновик поломал бы разбор. Отказ хранилища не глотается молча
 * (console.error) — по той же причине, что в caseDraft.ts: в черновике лежит
 * начатая человеком работа.
 */
import type { CaseQuickFields, CaseQuickStep } from './caseQuick';

const DRAFT_KEY = 'diary_draft_case_quick';

export interface CaseQuickDraft extends CaseQuickFields {
  step: CaseQuickStep;
}

export function saveQuickDraft(data: CaseQuickDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('case quick draft save failed', e);
  }
}

export function loadQuickDraft(): CaseQuickDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CaseQuickDraft) : null;
  } catch (e) {
    console.error('case quick draft load failed', e);
    return null;
  }
}

export function clearQuickDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.error('case quick draft clear failed', e);
  }
}
