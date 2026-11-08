// S16 (аудит 2026-11): User.firstName лежит открытым (реестр шифрования
// считает его публичным именем), а Google без имени клал туда почту. Провайдеры
// больше почту не шлют (google.provider.spec.ts, vk.provider.spec.ts,
// email-token.service.spec.ts), а единственное место записи держит замок:
// строка-адрес почты в открытое поле не попадает ни от какого провайдера.
import { AuthService } from './auth.service';
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';

function make(): { svc: AuthService; users: Row[]; providers: Row[] } {
  const users: Row[] = [];
  const providers: Row[] = [];
  const prisma = {
    authProvider: createFakeTable(providers),
    user: createFakeTable(users),
  } as never;
  const config = {
    getOrThrow: (k: string) => (k === 'JWT_SECRET' ? 's' : 'x'),
  } as never;
  const svc = new AuthService(
    prisma,
    config,
    { log: jest.fn() } as never,
    {} as never,
  );
  return { svc, users, providers };
}

describe('AuthService.findOrCreateUserByProvider — открытый firstName', () => {
  it('имя пишется как есть', async () => {
    const { svc, users } = make();
    await svc.findOrCreateUserByProvider('google', 'sub-1', 'Аня', 'a@x.ru');
    expect(users[0].firstName).toBe('Аня');
  });

  it('адрес почты вместо имени в firstName не пишется', async () => {
    const { svc, users } = make();
    await svc.findOrCreateUserByProvider('google', 'sub-2', 'ivan@example.com');
    expect(users[0].firstName ?? null).toBeNull();
  });

  it('нет имени — firstName пуст (фолбэки показа: «Профиль», «—»)', async () => {
    const { svc, users } = make();
    await svc.findOrCreateUserByProvider('email', 'b@x.ru');
    expect(users[0].firstName ?? null).toBeNull();
  });

  it('контроль: имя с @ не в форме адреса (ник из Telegram) остаётся', async () => {
    const { svc, users } = make();
    await svc.findOrCreateUserByProvider('telegram', '42', 'Аня @home');
    expect(users[0].firstName).toBe('Аня @home');
  });
});
