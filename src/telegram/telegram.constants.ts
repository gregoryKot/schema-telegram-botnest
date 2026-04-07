export const TELEGRAF_BOT = 'TELEGRAF_BOT';
export const CHANNEL = '@SchemeHappens';
export const BOOKING_URL = 'https://cal.com/kotlarewski';
export const BOT_USERNAME = process.env.BOT_USERNAME ?? 'Emotional_Needs_bot';
export const MINIAPP_APP_NAME = process.env.MINIAPP_APP_NAME ?? 'diary';
/** Base URL for webApp buttons (can be Vercel or custom domain) */
export const MINIAPP_URL = process.env.MINIAPP_URL ?? 'https://schema-miniapp.vercel.app';
/** t.me deep link — use for shareable invite links so Telegram opens the miniapp correctly */
export const MINIAPP_TGLINK = `https://t.me/${BOT_USERNAME}/${MINIAPP_APP_NAME}`;
export const DIARIES_URL = `${MINIAPP_URL}?section=diaries`;
