// Образцы для разбора роутов по методу (route-method-auth.ts): оба исхода
// и контрольные. Сценарий находки аудита 2026-10 — гвард на одном методе не
// должен делать защищённым соседний `@Post` с многострочным `@Throttle`.
import { routeMethods } from './route-method-auth';

const REL = 'x/x.controller.ts';
const guards = (src: string) =>
  Object.fromEntries(routeMethods(REL, src).map((m) => [m.key, m.guard]));

describe('routeMethods: гвард по методу', () => {
  it('гвард на классе покрывает все методы', () => {
    const src = `
      @Controller('x') @UseGuards(JwtAuthGuard)
      export class C { @Get('a') a() {} @Post('b') b() {} }`;
    expect(guards(src)).toEqual({
      [`${REL}:a`]: 'class',
      [`${REL}:b`]: 'class',
    });
  });

  it('гвард на одном методе не покрывает соседний анонимный @Post с многострочным @Throttle', () => {
    const src = `
      @Controller('x')
      export class C {
        @Get('me')
        @UseGuards(JwtAuthGuard)
        me() {}

        @Post('open')
        @Throttle({
          short: { limit: 3, ttl: 60_000 },
          long: { limit: 10, ttl: 3_600_000 },
        })
        @HttpCode(200)
        open() {}
      }`;
    expect(guards(src)).toEqual({
      [`${REL}:me`]: 'method',
      [`${REL}:open`]: null,
    });
  });

  it('гвард между @Post и многострочным @Throttle засчитывается', () => {
    const src = `
      @Controller('x')
      export class C {
        @Post('a')
        @Throttle({
          short: { limit: 1, ttl: 1 },
        })
        @UseGuards(OptionalJwtGuard)
        a() {}
      }`;
    expect(guards(src)).toEqual({ [`${REL}:a`]: 'method' });
  });

  it('чужой гвард не засчитывается', () => {
    const src = `
      @Controller('x') @UseGuards(SomeOtherGuard)
      export class C { @Get('a') a() {} }`;
    expect(guards(src)).toEqual({ [`${REL}:a`]: null });
  });

  it('метод без роут-декоратора и класс без @Controller игнорируются', () => {
    const src = `
      @Controller('x')
      export class C { @UseGuards(JwtAuthGuard) helper() {} @Get('a') a() {} }
      export class NotController { @Get('b') b() {} }`;
    expect(Object.keys(guards(src))).toEqual([`${REL}:a`]);
  });
});

describe('routeMethods: assertAdminKey по телу метода', () => {
  const src = `
    import { assertAdminKey } from './admin-key';
    @Controller('x')
    export class C {
      @Get('a') a(h: string) { assertAdminKey(h); }
      @Post('b') b(h: string) { return h; }
      @Delete('c') c() { this.other(); }
      other(h?: string) { assertAdminKey(h); }
    }`;

  it('импорт и вызов в чужом методе не считаются', () => {
    const by = Object.fromEntries(
      routeMethods(REL, src).map((m) => [m.key, m.callsAdminKey]),
    );
    expect(by).toEqual({
      [`${REL}:a`]: true,
      [`${REL}:b`]: false,
      [`${REL}:c`]: false,
    });
  });
});
