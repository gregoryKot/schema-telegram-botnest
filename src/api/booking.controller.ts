import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PersistentThrottle } from './persistent-throttle.decorator';
import { TelegramService } from '../telegram/telegram.service';
import { EmailService } from '../auth/email.service';
import { escapeHtml } from '../utils/escape-html';
import { BookingDto } from './dto/booking.dto';
import { contactLabelOr } from '../booking/contact-channel';

@Controller('api')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly email: EmailService,
  ) {}

  // M4 (аудит 2026-10): заявка = DM админу + письмо, штатный лимит в памяти
  // не держит два инстанса — тот же Postgres-счётчик, что у /booking/book.
  @Throttle({ long: { limit: 6, ttl: 3_600_000 } })
  @PersistentThrottle()
  @Post('booking')
  @HttpCode(HttpStatus.OK)
  submitBooking(@Body() dto: BookingDto): { ok: true } {
    const { name, contact, message, source, channel } = dto;

    if (!name?.trim() || !contact?.trim()) {
      return { ok: true }; // silent — validation on frontend
    }

    const n = escapeHtml(name.slice(0, 100).trim());
    const c = escapeHtml(contact.slice(0, 100).trim());
    const m = message?.trim() ? escapeHtml(message.slice(0, 500).trim()) : null;
    const src = source?.trim() ? source.trim().slice(0, 200) : null;
    const label = contactLabelOr(channel, 'Контакт');

    const tgText = [
      '📩 <b>Новая заявка с сайта</b>',
      '',
      `👤 <b>Имя:</b> ${n}`,
      `📬 <b>${label}:</b> ${c}`,
      m ? `💬 <b>Запрос:</b>\n${m}` : null,
      src ? `🔗 <b>Откуда:</b> ${escapeHtml(src)}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const emailText = [
      'Новая заявка с сайта',
      '',
      `Имя: ${name.trim()}`,
      `${label}: ${contact.trim()}`,
      m ? `Запрос:\n${message!.trim()}` : null,
      src ? `Откуда: ${src}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    this.logger.log('New booking received');

    // Оба канала fire-and-forget; почта — запасной путь, если Telegram упал.
    void this.telegram.notifyAdmin(tgText);
    void this.email.sendAdminNotification('📩 Новая заявка с сайта', emailText);

    return { ok: true };
  }
}
