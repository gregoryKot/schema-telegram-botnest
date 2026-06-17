// Ассист-режим — для ЦА в дистрессе это не поблажка, а этика продукта.
// Сложность должна идти от смысла, не от моторики. Храним в localStorage.
const K = 'rtym_assist_';

export interface Assist { extraLives: boolean; invuln: boolean; }

export function getAssist(): Assist {
  try {
    return { extraLives: localStorage.getItem(K + 'lives') === '1', invuln: localStorage.getItem(K + 'invuln') === '1' };
  } catch { return { extraLives: false, invuln: false }; }
}

export function setAssist(key: 'lives' | 'invuln', v: boolean) {
  try { localStorage.setItem(K + key, v ? '1' : '0'); } catch { /* приватный режим — ок */ }
}
