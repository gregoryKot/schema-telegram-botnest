import { describe, it, expect } from 'vitest';
import { joinSheetView } from './joinSheetView';
import type { InvitePreview } from './useInvitePreview';

const trFor = (form: 'ty' | 'vy') => (ty: string, vy: string) =>
  form === 'ty' ? ty : vy;
const ty = trFor('ty');
const ok = (connection: 'none' | 'same' | 'other'): InvitePreview => ({
  state: 'ok',
  therapistName: 'Анна',
  connection,
});

// QA 2026-11, М1: пограничные состояния ссылки-приглашения.
describe('joinSheetView', () => {
  it('живая ссылка, связи нет — согласие и «Присоединиться»', () => {
    const v = joinSheetView(false, ok('none'), ty);
    expect(v.title).toBe('Открыть доступ терапевту?');
    expect(v.explain).toMatch(/согласие открыть ему доступ/);
    expect(v.notice).toBeNull();
    expect(v.canJoin).toBe(true);
  });

  it('уже подключены к этому терапевту — «подключение уже есть», без согласия и без «попросите новую»', () => {
    const v = joinSheetView(false, ok('same'), ty);
    expect(v.title).toBe('Подключение уже есть');
    expect(v.explain).toBeNull();
    expect(v.notice?.role).toBe('status');
    expect(v.notice?.text).not.toMatch(/новую/);
    expect(v.canJoin).toBe(false);
  });

  it('подключены к другому — сказано до нажатия, кнопки «Присоединиться» нет', () => {
    const v = joinSheetView(false, ok('other'), ty);
    expect(v.title).toBe('Есть другой терапевт');
    expect(v.notice?.text).toMatch(/^У тебя уже есть подключение к другому/);
    expect(joinSheetView(false, ok('other'), trFor('vy')).notice?.text).toMatch(
      /^У вас .*отключитесь/,
    );
    expect(v.canJoin).toBe(false);
  });

  it('недействительная ссылка — без заголовка и текста согласия', () => {
    const v = joinSheetView(false, { state: 'invalid' }, ty);
    expect(v.title).not.toMatch(/доступ/);
    expect(v.explain).toBeNull();
    expect(v.notice?.role).toBe('alert');
    expect(v.canJoin).toBe(false);
    expect(v.closeLabel).toBe('Закрыть');
  });

  it('сеть упала или ещё грузится — согласие как раньше (fail-open по тексту, не по действию)', () => {
    for (const p of [{ state: 'unknown' }, { state: 'loading' }] as const) {
      expect(joinSheetView(false, p, ty).canJoin).toBe(true);
    }
  });

  it('пара — всегда согласие пары', () => {
    const v = joinSheetView(true, { state: 'unknown' }, ty);
    expect(v.title).toBe('Присоединиться к паре?');
    expect(v.canJoin).toBe(true);
  });
});
