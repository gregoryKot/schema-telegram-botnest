import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { EmailService } from '../auth/email.service';
import { encryptRecord } from '../utils/crypto';
import { INTRO_LEAD_SCHEMA } from './intro-lead.schema';
import {
  IntroLeadFields,
  IntroLeadInput,
  IntroLeadMessages,
  introLeadMessages,
  normalizeIntroLead,
} from './intro-lead.format';

// Потолок на ответ формы: Telegram/Resend могут висеть, а человек ждёт ответа.
// Заявка к этому моменту уже в БД; недоставленное подберёт повтор.
const DELIVERY_TIMEOUT_MS = 10_000;
function withTimeout(p: Promise<boolean>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}

/**
 * Заявка с формы знакомства на визитке (POST /api/booking).
 *
 * Раньше заявка жила только в уведомлениях (fire-and-forget DM + письмо):
 * мертвы оба канала — человек оставил имя и контакт, а следа нет (глобальный
 * аудит 2026-10-11). Теперь порядок как у броней (booking.create.ts): запись в
 * БД, потом уведомления с отчётом об исходе, факт доставки по каждому каналу
 * хранится в строке, недоставленное досылает крон
 * (intro-lead-redelivery.service.ts).
 */
@Injectable()
export class IntroLeadService {
  private readonly logger = new Logger(IntroLeadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly email: EmailService,
  ) {}

  async submit(dto: IntroLeadInput): Promise<{ ok: true }> {
    const lead = normalizeIntroLead(dto);
    if (!lead) return { ok: true }; // молча: обязательность проверяет фронт, не оракул
    let id: number;
    try {
      ({ id } = await this.prisma.introLead.create({
        data: encryptRecord(
          {
            clientName: lead.name,
            clientContact: lead.contact,
            message: lead.message,
            clientChannel: lead.channel,
            source: lead.source,
          },
          INTRO_LEAD_SCHEMA,
        ),
        select: { id: true },
      }));
    } catch (err) {
      return this.submitUnsaved(lead, err);
    }
    this.logger.log('New intro lead saved');
    await this.deliver(id, introLeadMessages(lead));
    return { ok: true };
  }

  /**
   * Запись не удалась. Лид уходит админу обоими каналами с пометкой «не
   * сохранилась в базе»; дошёл хоть один — человеку ответ «принято» (повтор
   * породил бы дубль), не дошёл ни один — честная ошибка, а не ложный успех.
   */
  private async submitUnsaved(
    lead: IntroLeadFields,
    err: unknown,
  ): Promise<{ ok: true }> {
    // В лог — только тип и код ошибки: текст ошибки Prisma может нести значения полей (PII).
    const code = (err as { code?: string })?.code ?? '';
    const kind = err instanceof Error ? err.name : typeof err;
    // Стабильный текст без цифр в начале — троттлинг AlertLogger по ключу.
    this.logger.error(
      `Intro lead create failed, lead alerted: ${kind} ${code}`,
    );
    const sent = await this.deliver(null, introLeadMessages(lead, 'unsaved'));
    if (sent.tg || sent.email) return { ok: true };
    throw new ServiceUnavailableException('Заявка не принята');
  }

  /** Отправка в оба канала. id=null — строки нет, флаги писать некуда. */
  async deliver(
    id: number | null,
    msg: IntroLeadMessages,
  ): Promise<{ tg: boolean; email: boolean }> {
    const [tg, email] = await Promise.all([
      this.channel(id, 'tg', () => this.telegram.notifyAdmin(msg.tg)),
      this.channel(id, 'email', () =>
        this.email.sendAdminNotification(msg.subject, msg.email),
      ),
    ]);
    return { tg, email };
  }

  /**
   * Один канал: отправить и сразу отметить доставку в строке (per-row, не пачкой).
   * Отметка — внутри цепочки самой отправки, а не после гонки с потолком: ответ
   * формы ждёт не дольше DELIVERY_TIMEOUT_MS, но площадка, ответившая позже,
   * всё равно проставит флаг — иначе повтор прислал бы дубль с ложной пометкой
   * «первая не дошла».
   */
  private channel(
    id: number | null,
    which: 'tg' | 'email',
    send: () => Promise<boolean>,
  ): Promise<boolean> {
    const sending = (async () => {
      let ok = false;
      try {
        ok = await send();
      } catch (err) {
        // Каналы сами глотают свои сбои; сюда доходит только неожиданное.
        this.logger.error('Intro lead notify threw', err as Error);
      }
      if (!ok || id === null) return ok;
      const at = new Date();
      await this.prisma.introLead
        .update({
          where: { id },
          data:
            which === 'tg' ? { tgDeliveredAt: at } : { emailDeliveredAt: at },
        })
        .catch((e) => this.logger.error('Intro lead delivery mark failed', e));
      return ok;
    })();
    return withTimeout(sending, DELIVERY_TIMEOUT_MS);
  }
}
