import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard, OptionalJwtGuard } from './jwt.guard';

// Минимальный ExecutionContext с заданным req
function ctx(req: any): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

function makeAuth(overrides: Record<string, jest.Mock> = {}) {
  return {
    verifyAccessToken: jest.fn(),
    verifyLinkToken: jest.fn(),
    ...overrides,
  } as any;
}

describe('JwtAuthGuard', () => {
  it('пропускает валидный Bearer и кладёт webUser', () => {
    const auth = makeAuth({ verifyAccessToken: jest.fn().mockReturnValue({ userId: 5n }) });
    const guard = new JwtAuthGuard(auth);
    const req: any = { headers: { authorization: 'Bearer good.token' } };
    expect(guard.canActivate(ctx(req))).toBe(true);
    expect(auth.verifyAccessToken).toHaveBeenCalledWith('good.token');
    expect(req.webUser).toEqual({ userId: 5n });
  });

  it('кидает 401 без заголовка Authorization', () => {
    const guard = new JwtAuthGuard(makeAuth());
    expect(() => guard.canActivate(ctx({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('кидает 401, если заголовок не начинается с Bearer', () => {
    const guard = new JwtAuthGuard(makeAuth());
    const req = { headers: { authorization: 'Basic abc' } };
    expect(() => guard.canActivate(ctx(req))).toThrow(UnauthorizedException);
  });

  it('пробрасывает ошибку невалидного токена (verifyAccessToken кидает)', () => {
    const auth = makeAuth({
      verifyAccessToken: jest.fn(() => { throw new UnauthorizedException('bad'); }),
    });
    const guard = new JwtAuthGuard(auth);
    const req = { headers: { authorization: 'Bearer tampered' } };
    expect(() => guard.canActivate(ctx(req))).toThrow(UnauthorizedException);
  });
});

describe('OptionalJwtGuard', () => {
  it('валидный Bearer → кладёт webUser, true', () => {
    const auth = makeAuth({ verifyAccessToken: jest.fn().mockReturnValue({ userId: 9n }) });
    const guard = new OptionalJwtGuard(auth);
    const req: any = { headers: { authorization: 'Bearer t' }, query: {} };
    expect(guard.canActivate(ctx(req))).toBe(true);
    expect(req.webUser).toEqual({ userId: 9n });
  });

  it('невалидный Bearer → игнор, true, без webUser (анонимный)', () => {
    const auth = makeAuth({
      verifyAccessToken: jest.fn(() => { throw new Error('bad'); }),
    });
    const guard = new OptionalJwtGuard(auth);
    const req: any = { headers: { authorization: 'Bearer bad' }, query: {} };
    expect(guard.canActivate(ctx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });

  it('без Bearer, но валидный link_token → webUser из link-токена', () => {
    const auth = makeAuth({ verifyLinkToken: jest.fn().mockReturnValue({ userId: 3n }) });
    const guard = new OptionalJwtGuard(auth);
    const req: any = { headers: {}, query: { link_token: 'lt' } };
    expect(guard.canActivate(ctx(req))).toBe(true);
    expect(auth.verifyLinkToken).toHaveBeenCalledWith('lt');
    expect(req.webUser).toEqual({ userId: 3n });
  });

  it('невалидный link_token → игнор, true, без webUser', () => {
    const auth = makeAuth({
      verifyLinkToken: jest.fn(() => { throw new Error('bad'); }),
    });
    const guard = new OptionalJwtGuard(auth);
    const req: any = { headers: {}, query: { link_token: 'bad' } };
    expect(guard.canActivate(ctx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });

  it('Bearer имеет приоритет над link_token', () => {
    const auth = makeAuth({
      verifyAccessToken: jest.fn().mockReturnValue({ userId: 1n }),
      verifyLinkToken: jest.fn().mockReturnValue({ userId: 2n }),
    });
    const guard = new OptionalJwtGuard(auth);
    const req: any = { headers: { authorization: 'Bearer t' }, query: { link_token: 'lt' } };
    guard.canActivate(ctx(req));
    expect(req.webUser).toEqual({ userId: 1n });
    expect(auth.verifyLinkToken).not.toHaveBeenCalled();
  });

  it('ничего нет → true, без webUser', () => {
    const guard = new OptionalJwtGuard(makeAuth());
    const req: any = { headers: {}, query: {} };
    expect(guard.canActivate(ctx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });
});
