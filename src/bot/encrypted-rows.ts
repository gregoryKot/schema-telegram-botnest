import type {
  PracticePlan,
  UserBeliefCheck,
  UserFlashcard,
  UserLetter,
  UserPractice,
  UserSafePlace,
} from '@prisma/client';
import { decrypt, decryptJson } from '../utils/crypto';

// Строки упражнений и практик глазами клиента: расшифровка одна на GET и на
// ответ записи. Инцидент 2026-10-26: ответ записи пересобирался отдельно от
// чтения, и POST /api/belief-checks и /api/practices отдавали шифротекст.
// Сверка «ответ записи = GET» с настоящим ключом —
// src/utils/encrypted-write-response.spec.ts.

export const readBeliefCheck = (r: UserBeliefCheck) => ({
  ...r,
  belief: decrypt(r.belief) ?? r.belief,
  evidenceFor: decryptJson<string[]>(r.evidenceFor) ?? [],
  evidenceAgainst: decryptJson<string[]>(r.evidenceAgainst) ?? [],
  reframe: decrypt(r.reframe),
});

export const readLetter = (r: UserLetter) => ({
  ...r,
  text: decrypt(r.text) ?? r.text,
});

export const readSafePlace = (r: UserSafePlace) => ({
  ...r,
  description: decrypt(r.description) ?? r.description,
});

export const readFlashcard = (r: UserFlashcard) => ({
  ...r,
  reflection: decrypt(r.reflection),
  action: decrypt(r.action),
});

export const readPractice = (r: UserPractice) => ({
  ...r,
  text: decrypt(r.text) ?? r.text,
});

export const readPlan = (r: PracticePlan) => ({
  ...r,
  practiceText: decrypt(r.practiceText) ?? r.practiceText,
});
