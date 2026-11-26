// Сверка (правило №4): нижняя граница веб-номеров на бэкенде
// (WEB_USER_ID_MIN — выдача id новому веб-аккаунту, адресация уведомлений) и
// на фронтах (shared/src/utils/therapistContact.ts — по ней «Написать
// терапевту» не строит tg://user?id=<веб-номер>, QA 2026-11 З6). Разойдутся —
// ссылка снова поведёт в несуществующий чат. Бэкенд shared не импортирует,
// поэтому константа читается из файла.
import { readFileSync } from 'fs';
import { join } from 'path';
import { WEB_USER_ID_MIN } from './user-id-range';

describe('WEB_USER_ID_MIN — бэкенд и фронты знают одну границу', () => {
  it('shared/src/utils/therapistContact.ts объявляет ту же границу', () => {
    const src = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        'shared',
        'src',
        'utils',
        'therapistContact.ts',
      ),
      'utf8',
    );
    const m = src.match(/export const WEB_USER_ID_MIN = '(\d+)'/);
    expect(m?.[1]).toBe(WEB_USER_ID_MIN.toString());
  });
});
