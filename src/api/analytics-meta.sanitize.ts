import type { AnalyticsEventName } from '../analytics/analytics.constants';
import {
  SHARE_CARD_KIND_SET,
  CRISIS_SURFACE_SET,
  TODAY_FOCUS_PRACTICE_SET,
  WEB_BANNER_ID_SET,
  ONBOARDING_STEP_SET,
  TODAY_BLOCK_SET,
  CUSTOMIZE_ENTRY_SET,
  HOME_SCREEN_ACTION_SET,
  HOME_SCREEN_SURFACE_SET,
  QUICK_ACTION_ID_SET,
  QUICK_ACTION_SURFACE_SET,
  ACCOUNT_LINK_HOST_SET,
  ACCOUNT_LINK_FAIL_REASON_SET,
} from './dto/analytics.dto';

// Санитизация meta для POST /api/event (правило №7/№10): пропускаем ТОЛЬКО
// известные поля конкретного события, чтобы в БД не утёк произвольный
// (потенциально PII) объект с клиента. Чистая функция — вынесена из
// analytics.controller.ts отдельным модулем (тестируется без Nest-обвязки).
export function sanitizeMeta(
  name: AnalyticsEventName,
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  if (name === 'share_card') {
    const kind = meta.kind;
    if (typeof kind === 'string' && SHARE_CARD_KIND_SET.has(kind)) {
      return { kind };
    }
    return undefined;
  }
  if (name === 'share_result') {
    const kind = meta.kind;
    const ok = meta.ok;
    if (
      typeof kind === 'string' &&
      SHARE_CARD_KIND_SET.has(kind) &&
      typeof ok === 'boolean'
    ) {
      return { kind, ok };
    }
    return undefined;
  }
  if (name === 'crisis_card_shown' || name === 'crisis_hotline_tapped') {
    const surface = meta.surface;
    if (typeof surface === 'string' && CRISIS_SURFACE_SET.has(surface)) {
      return { surface };
    }
    return undefined;
  }
  if (name === 'outbox_flush') {
    const count = meta.count;
    // Только положительное целое, с потолком — защита от мусора/переполнения.
    if (typeof count === 'number' && Number.isInteger(count) && count > 0) {
      return { count: Math.min(count, 1000) };
    }
    return undefined;
  }
  if (name === 'today_focus_change') {
    const practice = meta.practice;
    if (
      typeof practice === 'string' &&
      TODAY_FOCUS_PRACTICE_SET.has(practice)
    ) {
      return { practice };
    }
    return undefined;
  }
  if (name === 'today_streak_toggle') {
    const hidden = meta.hidden;
    if (typeof hidden === 'boolean') {
      return { hidden };
    }
    return undefined;
  }
  if (name === 'web_banner_open' || name === 'web_banner_dismiss') {
    const banner = meta.banner;
    if (typeof banner === 'string' && WEB_BANNER_ID_SET.has(banner)) {
      return { banner };
    }
    return undefined;
  }
  if (name === 'onboarding_step') {
    const step = meta.step;
    if (typeof step === 'string' && ONBOARDING_STEP_SET.has(step)) {
      return { step };
    }
    return undefined;
  }
  if (name === 'today_block_toggle') {
    const block = meta.block;
    const hidden = meta.hidden;
    if (
      typeof block === 'string' &&
      TODAY_BLOCK_SET.has(block) &&
      typeof hidden === 'boolean'
    ) {
      return { block, hidden };
    }
    return undefined;
  }
  if (name === 'today_customize_open') {
    const via = meta.via;
    if (typeof via === 'string' && CUSTOMIZE_ENTRY_SET.has(via)) {
      return { via };
    }
    return undefined;
  }
  if (name === 'home_screen_offer') {
    const action = meta.action;
    const surface = meta.surface;
    if (
      typeof action === 'string' &&
      HOME_SCREEN_ACTION_SET.has(action) &&
      typeof surface === 'string' &&
      HOME_SCREEN_SURFACE_SET.has(surface)
    ) {
      return { action, surface };
    }
    return undefined;
  }
  if (name === 'mode_card_saved') {
    const modeId = meta.modeId;
    const filledFields = meta.filledFields;
    if (
      typeof modeId === 'string' &&
      /^[a-z_]{1,64}$/.test(modeId) &&
      typeof filledFields === 'number' &&
      Number.isInteger(filledFields) &&
      filledFields >= 0 &&
      filledFields <= 7
    ) {
      return { modeId, filledFields };
    }
    return undefined;
  }
  if (name === 'mode_entry_saved') {
    const filledFields = meta.filledFields;
    const filledHealthy = meta.filledHealthy;
    if (
      typeof filledFields === 'number' &&
      Number.isInteger(filledFields) &&
      filledFields >= 0 &&
      filledFields <= 7 &&
      typeof filledHealthy === 'boolean'
    ) {
      return { filledFields, filledHealthy };
    }
    return undefined;
  }
  if (name === 'mode_test_completed') {
    const modeId = meta.modeId;
    if (typeof modeId === 'string' && /^[a-z_]{1,64}$/.test(modeId)) {
      return { modeId };
    }
    return undefined;
  }
  if (name === 'warm_words_open') {
    const count = meta.count;
    if (
      typeof count === 'number' &&
      Number.isInteger(count) &&
      count >= 0 &&
      count <= 1000
    ) {
      return { count };
    }
    // Событие валидно и без meta — count не обязателен для самого факта открытия.
    return {};
  }
  if (name === 'mode_chain_followup' || name === 'mode_doubt_switched') {
    const from = meta.from;
    const to = meta.to;
    if (
      typeof from === 'string' &&
      /^[a-z_]{1,64}$/.test(from) &&
      typeof to === 'string' &&
      /^[a-z_]{1,64}$/.test(to)
    ) {
      return { from, to };
    }
    return undefined;
  }
  if (name === 'mode_doubt_opened') {
    const modeId = meta.modeId;
    if (typeof modeId === 'string' && /^[a-z_]{1,64}$/.test(modeId)) {
      return { modeId };
    }
    return undefined;
  }
  if (name === 'plus_action') {
    const action = meta.action;
    if (typeof action === 'string' && QUICK_ACTION_ID_SET.has(action)) {
      return { action };
    }
    return undefined;
  }
  if (name === 'quick_action_toggle') {
    const action = meta.action;
    const hidden = meta.hidden;
    const surface = meta.surface;
    if (
      typeof action === 'string' &&
      QUICK_ACTION_ID_SET.has(action) &&
      typeof hidden === 'boolean' &&
      typeof surface === 'string' &&
      QUICK_ACTION_SURFACE_SET.has(surface)
    ) {
      return { action, hidden, surface };
    }
    return undefined;
  }
  if (name === 'account_link_started') {
    const host = meta.host;
    if (typeof host === 'string' && ACCOUNT_LINK_HOST_SET.has(host)) {
      return { host };
    }
    return undefined;
  }
  if (name === 'account_link_confirmed') {
    const host = meta.host;
    const merged = meta.merged;
    if (
      typeof host === 'string' &&
      ACCOUNT_LINK_HOST_SET.has(host) &&
      typeof merged === 'boolean'
    ) {
      return { host, merged };
    }
    return undefined;
  }
  if (name === 'account_link_failed') {
    const host = meta.host;
    const reason = meta.reason;
    if (
      typeof host === 'string' &&
      ACCOUNT_LINK_HOST_SET.has(host) &&
      typeof reason === 'string' &&
      ACCOUNT_LINK_FAIL_REASON_SET.has(reason)
    ) {
      return { host, reason };
    }
    return undefined;
  }
  // breath_start / stop_start / journey_open / ysq_help_open / plus_open —
  // без meta; поля отбрасываются.
  return undefined;
}
