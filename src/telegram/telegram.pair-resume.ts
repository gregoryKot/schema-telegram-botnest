// Вступление в пару после согласия: человек пришёл по `/start pair_<КОД>`
// (telegram.pair-start.ts), код ждал в памяти, пока он принимал соглашение.
// Общий для accept:(ty|vy) и легаси accept_consent в telegram.service.ts.
// Вынесено оттуда: сервис упёрся в лимит размера (правило №10).
//
// Код снимается с карты ДО записи — второй тап, пришедший, пока идёт запись,
// кода не найдёт и второй joinPair не начнёт. Находка 2026-11-06: на сбое
// записи код терялся — человек видел «попробуй нажать ещё раз», а повторное
// нажатие показывало обычное приветствие: в пару не вступил, и об этом не
// сказано. Теперь на сбое код возвращается, а ошибка уходит хендлеру — он и
// просит нажать ещё раз.
import type { Context } from 'telegraf';
import type { PairStartDeps } from './telegram.pair-start';
import {
  CABINET_KEYBOARD,
  pairJoinResultText,
  resolveForm,
} from './telegram.reply-helpers';

/** true — флоу пары завершён и сообщение показано; false — кода нет. */
export async function resumePendingPair(
  deps: PairStartDeps,
  ctx: Context,
  rawId: number,
): Promise<boolean> {
  const pending = deps.pending.get(rawId);
  if (!pending || pending.expiresAt <= deps.now()) return false;
  deps.pending.delete(rawId);
  let ok: boolean;
  try {
    const userId = await deps.accountService.canonicalUserId(rawId);
    ok = await deps.pairsService.joinPair(userId, pending.code);
  } catch (err) {
    deps.pending.set(rawId, pending);
    throw err;
  }
  const form = await resolveForm(deps.accountService, deps.botService, rawId);
  const text = pairJoinResultText(ok, form);
  try {
    await ctx.editMessageText(text, CABINET_KEYBOARD);
  } catch {
    await ctx.reply(text, CABINET_KEYBOARD);
  }
  return true;
}
