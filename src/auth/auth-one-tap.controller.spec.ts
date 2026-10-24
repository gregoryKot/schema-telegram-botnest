// Google One Tap: анонимные роуты (у человека сессии ещё нет). POST защищён
// CSRF-заголовком — иначе сторонний сайт мог бы дёрнуть его с чужой всплывашкой —
// и nonce-кукой (B-16 аудита 2026-10). Контроллер — тонкий делегат;
// requireCsrf — реальный (hasCsrfHeader из auth-http.util).
jest.mock('./providers/google.provider', () => ({ GoogleProvider: class {} }));

import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthOneTapController } from './auth-one-tap.controller';
import type {
  GoogleOneTapService,
  OneTapLoginResult,
} from './google-one-tap.service';
import type { SecurityLogService } from './security-log.service';
import type { GoogleOneTapDto } from './dto/google-one-tap.dto';

const BODY: GoogleOneTapDto = { credential: 'header.payload.sig' };

function make() {
  const login = jest.fn();
  const log = jest.fn();
  const controller = new AuthOneTapController(
    { login } as unknown as GoogleOneTapService,
    { log } as unknown as SecurityLogService,
  );
  return { controller, login, log };
}

function makeReq(over: Partial<Request> = {}): Request {
  return { headers: {}, ip: '1.2.3.4', cookies: {}, ...over } as Request;
}

function makeRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn(), set: jest.fn() };
}

describe('AuthOneTapController.nonce', () => {
  it('ставит gsi_nonce-куку, отдаёт хеш и запрещает кэш', () => {
    const { controller } = make();
    const res = makeRes();
    const out = controller.nonce(res as unknown as Response);
    expect(res.cookie).toHaveBeenCalledWith(
      'gsi_nonce',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
    );
    expect(out.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

describe('AuthOneTapController.googleOneTap', () => {
  it('нет CSRF-заголовка → UnauthorizedException, login не вызывается', async () => {
    const { controller, login } = make();
    await expect(
      controller.googleOneTap(
        BODY,
        makeReq(),
        makeRes() as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(login).not.toHaveBeenCalled();
  });

  it('есть x-requested-with → login(credential, кука gsi_nonce, res, ip, ua), результат возвращается', async () => {
    const { controller, login } = make();
    const result: OneTapLoginResult = { accessToken: 'a', expiresIn: 900 };
    login.mockResolvedValue(result);
    const req = makeReq({
      headers: { 'x-requested-with': 'one-tap', 'user-agent': 'UA/1.0' },
      cookies: { gsi_nonce: 'secret-1' },
    } as Partial<Request>);
    const res = makeRes() as unknown as Response;
    await expect(controller.googleOneTap(BODY, req, res)).resolves.toBe(result);
    expect(login).toHaveBeenCalledWith(
      'header.payload.sig',
      'secret-1',
      res,
      '1.2.3.4',
      'UA/1.0',
    );
  });

  it('куки нет → в login уходит undefined (сервис отклонит), application/json проходит CSRF-fallback', async () => {
    const { controller, login } = make();
    login.mockResolvedValue({ twofa: true, challengeToken: 'c' });
    const req = makeReq({
      headers: { 'content-type': 'application/json' },
    } as Partial<Request>);
    const res = makeRes() as unknown as Response;
    await controller.googleOneTap(BODY, req, res);
    expect(login).toHaveBeenCalledWith(
      'header.payload.sig',
      undefined,
      res,
      '1.2.3.4',
      undefined,
    );
  });
});
