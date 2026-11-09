// Вид окон первого входа (b06-entry): исходы приглашения — те же, что OUTCOME_LOOK (литералы
// держат главный чанк, сверка — здесь, правило №4); шаги согласий — три разные бумаги дальше 40°
// друг от друга, знаки есть в словаре; варианты «ты/вы» не совпадают ни друг с другом, ни с шапкой.
import { describe, it, expect } from 'vitest';
import { OUTCOME_LOOK, PAPER_HUE, SIGN_KEYS } from '../../../../shared/src/theme/entityLook';
import {
  ADDRESS_FORM_HUE, CONSENT_HUES, CONSENT_LOOK, CONSENT_STEPS, DONATE_HUE, ENTRY_HUE,
  JOIN_DONE_LOOK, JOIN_STALE_LOOK, alertParts, hasLongWord, joinLook,
} from './entryLook';

const gap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
const PALETTE: readonly number[] = Object.values(PAPER_HUE);

describe('entryLook', () => {
  it('исходы приглашения — «готово» и «устарело» таблицы исходов (сама таблица сверена в outcomeLook.test.ts)', () => {
    expect(JOIN_DONE_LOOK).toEqual(OUTCOME_LOOK.done);
    expect(JOIN_STALE_LOOK).toEqual(OUTCOME_LOOK.wait);
  });

  it('hasLongWord: слово длиннее колонки рядом со знаком на 320 — только у пары и конфиденциальности', () => {
    for (const t of ['Присоединиться к паре?', 'Данные и конфиденциальность']) expect(hasLongWord(t)).toBe(true);
    for (const t of ['Поддержать проект', 'Как удобнее общаться?', 'Открыть доступ терапевту?', 'Подключение уже есть',
      'Ссылка не действует', 'Есть другой терапевт', 'Доступ открыт', 'Важно знать', 'Всё по схеме']) {
      expect(hasLongWord(t)).toBe(false);
    }
  });

  it('joinLook: «Доступ открыт» — готово, пара — её вид, код не действует — устарело, иначе — терапевт', () => {
    expect(joinLook(false, 'ok', true)).toBe(JOIN_DONE_LOOK);
    expect(joinLook(true, 'unknown')).toBe('pair');
    expect(joinLook(false, 'invalid')).toBe(JOIN_STALE_LOOK);
    for (const s of ['ok', 'unknown', 'loading'] as const) expect(joinLook(false, s)).toBe('therapist');
  });

  it('три шага согласий — три бумаги палитры, соседи дальше 40°, знаки — из словаря', () => {
    expect(CONSENT_HUES).toEqual(CONSENT_STEPS.map((s) => CONSENT_LOOK[s].hue));
    expect(new Set(CONSENT_HUES).size).toBe(3);
    for (const h of CONSENT_HUES) expect(PALETTE).toContain(h);
    for (let i = 1; i < CONSENT_HUES.length; i++) expect(gap(CONSENT_HUES[i - 1], CONSENT_HUES[i])).toBeGreaterThanOrEqual(40);
    for (const s of CONSENT_STEPS) {
      const sign = CONSENT_LOOK[s].sign;
      if (sign) expect(SIGN_KEYS).toContain(sign);
    }
  });

  it('плитки «ты/вы» — разной бумаги, не бумаги шапки; донат — бумага палитры', () => {
    expect(gap(ADDRESS_FORM_HUE.ty, ADDRESS_FORM_HUE.vy)).toBeGreaterThanOrEqual(40);
    expect(gap(ADDRESS_FORM_HUE.ty, ENTRY_HUE)).toBeGreaterThanOrEqual(40);
    expect(gap(ADDRESS_FORM_HUE.vy, ENTRY_HUE)).toBeGreaterThanOrEqual(40);
    for (const h of [ENTRY_HUE, ADDRESS_FORM_HUE.ty, ADDRESS_FORM_HUE.vy, DONATE_HUE]) expect(PALETTE).toContain(h);
  });

  it('alertParts: первая фраза — заголовок, остальное — текст; одна фраза — только заголовок', () => {
    expect(alertParts('Не получилось присоединиться. Проверь ссылку и попробуй ещё раз.'))
      .toEqual({ title: 'Не получилось присоединиться.', text: 'Проверь ссылку и попробуй ещё раз.' });
    expect(alertParts('Сервер не ответил. Повторить можно чуть позже'))
      .toEqual({ title: 'Сервер не ответил.', text: 'Повторить можно чуть позже' });
    expect(alertParts('Код не действует')).toEqual({ title: 'Код не действует' });
  });
});
