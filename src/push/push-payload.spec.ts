// Маппинг уведомления очереди в payload веб-пуша (push-payload.ts): тот же
// шаблон, что у Telegram; url — только путь того же сайта.
import { Markup } from 'telegraf';
import { renderTemplate } from '../notification/notification.templates';
import type { NotificationType } from '../notification/notification.service';
import { APP_URL, BOOKING_URL } from '../telegram/telegram.constants';
import {
  clipBody,
  pathFromMarkup,
  PUSH_BODY_MAX,
  PUSH_FALLBACK_URL,
  PUSH_TITLE,
  sitePath,
  toPushPayload,
} from './push-payload';

function fromTemplate(
  type: NotificationType,
  payload: Record<string, unknown>,
  form: 'ty' | 'vy' = 'ty',
) {
  const tpl = renderTemplate(type, payload, form);
  if (!tpl) throw new Error(`нет шаблона ${type}`);
  return {
    tpl,
    push: toPushPayload(type, tpl.text, tpl.keyboard?.reply_markup),
  };
}

describe('toPushPayload — шаблон очереди → payload пуша', () => {
  it('reminder: заголовок продукта, текст шаблона, кнопка «Открыть» → /today, со звуком', () => {
    const { tpl, push } = fromTemplate('reminder', { variant: 0 });
    expect(push).toEqual({
      title: PUSH_TITLE,
      body: clipBody(tpl.text),
      url: '/today',
      tag: 'reminder',
    });
    expect(push).not.toHaveProperty('silent');
  });

  it('task_assigned: ведёт к самому заданию — путь с startapp=tasks_<id>', () => {
    const { push } = fromTemplate('task_assigned', {
      taskId: 42,
    });
    expect(push.url).toBe('/today?startapp=tasks_42');
    expect(push.body).toContain('Новое задание от терапевта');
    expect(push.tag).toBe('task_assigned');
  });

  it('summary: без звука, как disable_notification у Telegram', () => {
    const { push } = fromTemplate('summary', { text: 'Итог дня' });
    expect(push).toMatchObject({ silent: true, url: '/today', tag: 'summary' });
  });

  it('шаблон без кнопок (security_notice) — «Сегодня»', () => {
    const { tpl, push } = fromTemplate('security_notice', {
      kind: 'totp_locked',
    });
    expect(tpl.keyboard).toBeUndefined();
    expect(push.url).toBe(PUSH_FALLBACK_URL);
  });

  it('обращение «вы» доезжает до текста пуша', () => {
    const ty = fromTemplate('ysq_requested', {}, 'ty').push.body;
    const vy = fromTemplate('ysq_requested', {}, 'vy').push.body;
    expect(ty).toContain('Твой терапевт');
    expect(vy).toContain('Ваш терапевт');
  });
});

describe('pathFromMarkup / sitePath — только путь того же сайта', () => {
  it('кнопки-действия бота и внешний адрес визитки → «Сегодня»', () => {
    const markup = Markup.inlineKeyboard([
      [Markup.button.callback('⏰ Через час', 'snooze_reminder')],
      [Markup.button.url('📝 Записаться', BOOKING_URL)],
    ]).reply_markup;
    expect(pathFromMarkup(markup)).toBe(PUSH_FALLBACK_URL);
  });

  it('берётся первая кнопка, ведущая на сайт, даже если перед ней внешняя', () => {
    const markup = Markup.inlineKeyboard([
      [Markup.button.url('📝 Записаться', BOOKING_URL)],
      [Markup.button.url('💛 Поддержать', `${APP_URL}/donate`)],
    ]).reply_markup;
    expect(pathFromMarkup(markup)).toBe('/donate');
  });

  it.each([
    ['https://schemehappens.ru/today?startapp=ysq', '/today?startapp=ysq'],
    ['https://schemehappens.ru/practice', '/practice'],
  ])('%s → %s', (href, path) => {
    expect(sitePath(href, 'https://schemehappens.ru')).toBe(path);
  });

  it.each([
    'https://kotlarewski.gr/#booking',
    'http://schemehappens.ru/today', // другой origin: схема
    'https://schemehappens.ru.evil.com/today',
    'https://schemehappens.ru//evil.com/x', // путь «//…» браузер прочтёт как хост
    'не адрес',
  ])('%s → null', (href) => {
    expect(sitePath(href, 'https://schemehappens.ru')).toBeNull();
  });

  it('разметки нет или она странной формы — «Сегодня»', () => {
    expect(pathFromMarkup(undefined)).toBe(PUSH_FALLBACK_URL);
    expect(pathFromMarkup({ inline_keyboard: 'x' })).toBe(PUSH_FALLBACK_URL);
    expect(pathFromMarkup({ inline_keyboard: [[{ url: 5 }]] })).toBe(
      PUSH_FALLBACK_URL,
    );
  });
});

describe('clipBody', () => {
  it('короткий текст — как есть, без пробелов по краям', () => {
    expect(clipBody('  Привет  ')).toBe('Привет');
  });

  it('длинный — по границе слова с «…», не длиннее предела', () => {
    const text = 'слово '.repeat(100);
    const out = clipBody(text);
    expect(out.length).toBeLessThanOrEqual(PUSH_BODY_MAX);
    expect(out.endsWith('слово…')).toBe(true);
  });

  it('одно длинное слово режется по пределу', () => {
    const out = clipBody('а'.repeat(500), 20);
    expect(out).toBe(`${'а'.repeat(19)}…`);
  });
});
