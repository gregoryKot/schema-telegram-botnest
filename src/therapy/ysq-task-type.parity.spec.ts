// Сверка (правило №4): тип задания «пройти тест на схемы» на бэкенде
// (YSQ_TASK_TYPE — по нему создаётся запрос терапевта и закрывается при
// сохранении теста) и на фронтах (shared/src/tasks/ysqRequestMark.ts — по нему
// задание ведёт в тест и ставится пометка у входа в тест). Разойдутся — клиент
// увидит задание, которое никуда не ведёт. Бэкенд shared не импортирует,
// поэтому константа читается из файла (образец — therapy-invite-code.parity).
import { readFileSync } from 'fs';
import { join } from 'path';
import { YSQ_TASK_TYPE } from './ysq-request';

describe('YSQ_TASK_TYPE — бэкенд и фронты знают один тип', () => {
  it('shared/src/tasks/ysqRequestMark.ts объявляет тот же тип', () => {
    const src = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        'shared',
        'src',
        'tasks',
        'ysqRequestMark.ts',
      ),
      'utf8',
    );
    const m = src.match(/export const YSQ_TASK_TYPE = '([^']+)'/);
    expect(m?.[1]).toBe(YSQ_TASK_TYPE);
  });
});
