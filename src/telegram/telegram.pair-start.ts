// Ветка `/start pair_<КОД>` — приглашение в пару по ссылке от друга.
// Вынесена из telegram.service.ts отдельным файлом: сервис давно упёрся в
// лимит размера (правило №10), а сама ветка самодостаточна — у неё свой
// сценарий с ожиданием согласия и собственная память о коде.
import { Context } from 'telegraf';
import { BotService } from '../bot/bot.service';
import { PairsService } from '../bot/pairs.service';
import { AccountService } from '../bot/account.service';
import { CONSENT_TEXT } from './telegram.consent-text';
import { buildConsentKeyboard } from './telegram.keyboards';
import {
  MINIAPP_ONLY_KEYBOARD,
  pairJoinResultText,
  resolveForm,
} from './telegram.reply-helpers';

export const PAIR_PREFIX = 'pair_';
/** Сколько ждём согласия, прежде чем забыть код приглашения. */
export const PENDING_PAIR_TTL_MS = 15 * 60_000;

export interface PendingPairCode {
  code: string;
  expiresAt: number;
}

export interface PairStartDeps {
  botService: BotService;
  pairsService: PairsService;
  accountService: AccountService;
  pending: Map<number, PendingPairCode>;
  now: () => number;
}

/**
 * Человек пришёл по ссылке-приглашению. Согласие ещё не принято — код
 * запоминаем и спрашиваем согласие: без него в пару вступать нельзя, а терять
 * приглашение из-за этого незачем.
 */
export async function handlePairStart(
  deps: PairStartDeps,
  ctx: Context,
  payload: string,
  rawId: number,
  userId: bigint,
): Promise<void> {
  const code = payload.slice(PAIR_PREFIX.length).toUpperCase();
  if (!(await deps.botService.hasAcceptedDisclaimer(userId))) {
    deps.pending.set(rawId, {
      code,
      expiresAt: deps.now() + PENDING_PAIR_TTL_MS,
    });
    await ctx.reply(CONSENT_TEXT, buildConsentKeyboard());
    return;
  }
  const ok = await deps.pairsService.joinPair(userId, code);
  const form = await resolveForm(deps.accountService, deps.botService, rawId);
  await ctx.reply(pairJoinResultText(ok, form), MINIAPP_ONLY_KEYBOARD);
}
