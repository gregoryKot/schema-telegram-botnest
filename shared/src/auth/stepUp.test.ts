// Разбор ответа ручек привязки при включённой 2FA (S12, аудит 2026-11).
import { describe, it, expect } from 'vitest';
import {
  STEP_UP_HEADER,
  buildStepUpText,
  lockedFor,
  readStepUpVerdict,
  stepUpHeader,
} from './stepUp';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

describe('readStepUpVerdict', () => {
  it('403 totp_required — нужен код; тело остаётся читаемым для вызывающего', async () => {
    const res = json(403, { message: 'Нужен код', reason: 'totp_required' });
    expect(await readStepUpVerdict(res)).toEqual({ kind: 'code_required' });
    expect(((await res.json()) as { reason: string }).reason).toBe(
      'totp_required',
    );
  });

  it('429 totp_locked — пауза с retryAfter', async () => {
    const res = json(429, { reason: 'totp_locked', retryAfter: 3600 });
    expect(await readStepUpVerdict(res)).toEqual({
      kind: 'locked',
      retryAfterS: 3600,
    });
  });

  it('прочее — pass: успех, чужой 403, обычный лимит 429, не-JSON', async () => {
    expect(await readStepUpVerdict(json(200, { ok: true }))).toEqual({
      kind: 'pass',
    });
    expect(await readStepUpVerdict(json(403, { reason: 'csrf' }))).toEqual({
      kind: 'pass',
    });
    expect(await readStepUpVerdict(json(429, { message: 'Too Many' }))).toEqual(
      { kind: 'pass' },
    );
    expect(
      await readStepUpVerdict(new Response('<html>', { status: 403 })),
    ).toEqual({ kind: 'pass' });
  });

  it('тестовый двойник без clone() тоже разбирается', async () => {
    const fake = {
      status: 403,
      json: () => Promise.resolve({ reason: 'totp_required' }),
    } as unknown as Response;
    expect(await readStepUpVerdict(fake)).toEqual({ kind: 'code_required' });
  });
});

describe('stepUpHeader и тексты', () => {
  it('заголовок только с кодом', () => {
    expect(stepUpHeader()).toEqual({});
    expect(stepUpHeader('123456')).toEqual({ [STEP_UP_HEADER]: '123456' });
  });

  it('пауза: минуты, часы, без срока — «позже»', () => {
    expect(lockedFor(600)).toBe('через 10 мин');
    expect(lockedFor(7 * 3600)).toBe('через 7 ч');
    const vy = buildStepUpText((_ty, v) => v);
    expect(vy.locked(null)).toMatch(/попробуйте позже\.$/);
    expect(vy.locked(1200)).toMatch(/попробуйте через 20 мин\.$/);
    expect(vy.title).toBe('Подтвердите, что это вы');
  });

  it('лид резервного кода не просит код из приложения — в обеих формах', () => {
    const ty = buildStepUpText((t) => t);
    const vy = buildStepUpText((_ty, v) => v);
    expect(ty.leadRecovery).toMatch(/Введи один из резервных кодов — каждый срабатывает один раз\.$/);
    expect(vy.leadRecovery).toMatch(/Введите один из резервных кодов — каждый срабатывает один раз\.$/);
    for (const c of [ty, vy]) {
      expect(c.leadRecovery).not.toContain('аутентификатор');
      expect(c.lead).toContain('аутентификатор');
    }
  });
});
