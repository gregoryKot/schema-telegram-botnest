// Вид разбора «Критик или забота?» (b18): девять бусин-примет и знак вердикта. Логика ответов и вердикта —
// shared/src/phraseCheck; здесь только «как это выглядит», без своих порогов:
//  • бусина на примету: отвеченная — критик (слива) или забота (мох), текущая — кольцом, впереди — пусто;
//  • вердикт: «самокоррекция» (переписать не предлагается) — Together на мху, тот же вердикт, что у фразы
//    со всеми приметами, — Looming на сливе, всё между — оба знака на соломе (голос смешанный).
import { PHRASE_CRITERIA, PHRASE_MARK_IDS, type PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';
import { buildVerdict, type PhraseVerdict } from '../../../../../shared/src/phraseCheck/verdict';
import { MODE_GROUP_SIGN, PAPER_HUE, modeGroupLook, type PaperHue, type SignKey } from '../../../../../shared/src/theme/entityLook';

export type BeadState = 'critic' | 'care' | 'now' | 'todo';

/** Состояние каждой из девяти бусин: `markIndex` — текущая примета (−1 — фраза ещё не разбирается,
 *  9 и дальше — все отвечены), `marks` — приметы, засчитанные критику. */
export function beadStates(marks: readonly PhraseMarkId[], markIndex: number): BeadState[] {
  return PHRASE_CRITERIA.map((c, i) => {
    if (i < markIndex) return marks.includes(c.id) ? 'critic' : 'care';
    return i === markIndex ? 'now' : 'todo';
  });
}

export type VerdictTone = 'care' | 'mixed' | 'critic';

const CRITIC_TITLE = buildVerdict([...PHRASE_MARK_IDS]).title;

export function verdictTone(v: Pick<PhraseVerdict, 'title' | 'suggestRewrite'>): VerdictTone {
  if (!v.suggestRewrite) return 'care';
  return v.title === CRITIC_TITLE ? 'critic' : 'mixed';
}

/** Голоса разбора — бумага и знак групп режимов (критики — слива и Looming, здоровые — мох и Together). */
export const CRITIC_LOOK = modeGroupLook('critic');
export const CARE_LOOK = modeGroupLook('healthy');

export const VERDICT_LOOK: Record<VerdictTone, { hue: PaperHue; signs: SignKey[] }> = {
  care: { hue: CARE_LOOK.hue, signs: [MODE_GROUP_SIGN.healthy] },
  mixed: { hue: PAPER_HUE.straw, signs: [MODE_GROUP_SIGN.critic, MODE_GROUP_SIGN.healthy] },
  critic: { hue: CRITIC_LOOK.hue, signs: [MODE_GROUP_SIGN.critic] },
};
