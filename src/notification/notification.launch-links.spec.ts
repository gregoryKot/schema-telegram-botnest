// Аудит 2026-11, U2: кнопки «Терапевт назначил задание» и «📋 Пройти тест»
// открывали «Сегодня» (CABINET_URL), где нет ни заданий, ни теста. Теперь они
// несут ссылку запуска (`?startapp=tasks_<id>` / `ysq`), а сайт её разбирает
// (shared/src/host/startParam.ts). Сверка обеих сторон шва (правило №4): то,
// что кладёт бот, разбирает фронт, — иначе кнопка снова тихо откроет «Сегодня».
// shared — ESM, jest бэкенда его не грузит: разбор фронта сверяется по тексту
// файла (тот же приём, что therapy-nudge-sync.invariants.spec.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderTemplate } from './notification.templates';
import { CABINET_URL } from '../telegram/telegram.constants';

const PARSER = readFileSync(
  join(__dirname, '..', '..', 'shared', 'src', 'host', 'startParam.ts'),
  'utf8',
);

/** Адрес единственной web_app-кнопки шаблона. */
function buttonUrl(
  type: 'task_assigned' | 'ysq_requested',
  payload: object,
): string {
  const kb = renderTemplate(type, payload as Record<string, unknown>)!
    .keyboard as unknown as {
    reply_markup: {
      inline_keyboard: Array<Array<{ web_app?: { url: string } }>>;
    };
  };
  const url = kb.reply_markup.inline_keyboard[0][0].web_app?.url;
  if (!url) throw new Error(`${type}: у кнопки нет web_app-адреса`);
  return url;
}

const launchParam = (url: string) => new URL(url).searchParams.get('startapp');

describe('ссылки запуска в уведомлениях о задании и тесте (U2)', () => {
  it('задание с id ведёт на это задание, а не на «Сегодня»', () => {
    const url = buttonUrl('task_assigned', { text: 'Письмо себе', taskId: 42 });
    expect(url).toBe(`${CABINET_URL}?startapp=tasks_42`);
  });

  it('без id (старое уведомление в очереди) — «Задания» списком', () => {
    const url = buttonUrl('task_assigned', { text: 'Задание' });
    expect(launchParam(url)).toBe('tasks');
  });

  it('id не числом в payload в ссылку не попадает', () => {
    const url = buttonUrl('task_assigned', { text: 'Задание', taskId: '1;x' });
    expect(launchParam(url)).toBe('tasks');
  });

  it('«Пройти тест» открывает тест на схемы', () => {
    const url = buttonUrl('ysq_requested', { therapistName: 'Анна' });
    expect(launchParam(url)).toBe('ysq');
  });

  it('фронт разбирает каждое значение, которое кладёт бот', () => {
    expect(PARSER).toContain("raw === 'tasks'");
    expect(PARSER).toContain("raw === 'ysq'");
    expect(PARSER).toMatch(/TASK_PREFIX = 'tasks_'/);
    expect(PARSER).toContain("['therapy', 'therapy_']");
  });
});
