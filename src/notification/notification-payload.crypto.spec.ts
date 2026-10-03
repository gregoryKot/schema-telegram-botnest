// Аудит 2026-10, T1: текст задания терапевта лежал в ScheduledNotification.payload
// открытым текстом, а реестр шифрования уверял «свободного текста нет».
// Ключ выставляем ДО загрузки crypto.ts (он читает env при загрузке модуля):
// без ключа encrypt() отдаёт текст как есть, и проверка «в БД не открытый
// текст» ничего бы не значила.
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

import { decryptPayload, encryptPayload } from './notification-payload.crypto';
import { reencrypt } from '../utils/crypto';
import { NotificationService } from './notification.service';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';
import { renderTemplate } from './notification.templates';

function makeSvc() {
  const table = createFakeTable([]);
  const prisma = { scheduledNotification: table } as any;
  return { svc: new NotificationService(prisma), table };
}

describe('NotificationService — шифрование payload', () => {
  it('task_assigned: payload в БД не открытым текстом', async () => {
    const { svc, table } = makeSvc();
    await svc.schedule(5n, 'task_assigned', new Date(), {
      text: 'Напиши письмо маме',
      needId: 'attachment',
      dueDate: '2026-10-10',
    });
    const stored = table.create.mock.calls[0][0].data.payload;
    expect(typeof stored).toBe('string'); // зашифрованная JSON-строка
    expect(JSON.stringify(stored)).not.toContain('письмо');
    expect(JSON.stringify(stored)).not.toContain('attachment');
  });

  it('ysq_requested: therapistName шифруется', async () => {
    const { svc, table } = makeSvc();
    await svc.schedule(5n, 'ysq_requested', new Date(), {
      therapistName: 'Мария Иванова',
    });
    const stored = table.create.mock.calls[0][0].data.payload;
    expect(JSON.stringify(stored)).not.toContain('Иванова');
  });

  it('practice_reminder: practiceText шифруется', async () => {
    const { svc, table } = makeSvc();
    await svc.schedule(5n, 'practice_reminder', new Date(), {
      practiceText: 'Позвонить сестре',
      planId: 3,
    });
    const stored = table.create.mock.calls[0][0].data.payload;
    expect(JSON.stringify(stored)).not.toContain('сестре');
  });

  it('связка запись → чтение: getDue отдаёт расшифрованный текст, шаблон рендерится', async () => {
    const { svc } = makeSvc();
    await svc.schedule(5n, 'task_assigned', new Date(Date.now() - 1000), {
      text: 'Напиши письмо маме',
    });
    const [due] = await svc.getDue();
    expect(due.payload).toEqual({ text: 'Напиши письмо маме' });
    const tpl = renderTemplate(
      'task_assigned',
      due.payload as Record<string, unknown>,
    );
    expect(tpl?.text).toContain('Напиши письмо маме');
  });

  it('старая строка с открытым текстом читается как есть', async () => {
    const table = createFakeTable([
      {
        id: 1,
        userId: 5n,
        type: 'task_assigned',
        sendAt: new Date(Date.now() - 1000),
        sentAt: null,
        cancelledAt: null,
        payload: { text: 'старое задание' },
      },
    ]);
    const svc = new NotificationService({
      scheduledNotification: table,
    } as any);
    const [due] = await svc.getDue();
    expect((due.payload as { text: string }).text).toBe('старое задание');
  });

  it('без payload — undefined, не падает', async () => {
    const { svc, table } = makeSvc();
    await svc.schedule(5n, 'reminder', new Date());
    expect(table.create.mock.calls[0][0].data.payload).toBeUndefined();
  });

  it('нерасшифровываемая строка → null (шаблон вернёт «нечего слать»), не исключение', () => {
    expect(decryptPayload('это не шифротекст и не JSON')).toBeNull();
  });

  // F1: шаг ротации ключа (scripts/rotate-encryption-key.ts) гонит строковый
  // payload через reencrypt — результат обязан читаться так же.
  it('reencrypt (шаг ротации) даёт строку, которую decryptPayload читает как прежде', () => {
    const stored = encryptPayload({ text: 'Напиши письмо маме' })!;
    const rotated = reencrypt(stored);
    expect(rotated).not.toBeNull();
    expect(decryptPayload(rotated)).toEqual({ text: 'Напиши письмо маме' });
  });
});
