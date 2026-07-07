import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';
import { EmailService } from '../auth/email.service';

interface BookingDto {
  name: string;
  contact: string;
  message?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

@Controller('api')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly email: EmailService,
  ) {}

  @Post('booking')
  @HttpCode(HttpStatus.OK)
  async submitBooking(@Body() dto: BookingDto): Promise<{ ok: true }> {
    const { name, contact, message } = dto;

    if (!name?.trim() || !contact?.trim()) {
      return { ok: true }; // silent — validation on frontend
    }

    const n = escapeHtml(name.slice(0, 100).trim());
    const c = escapeHtml(contact.slice(0, 100).trim());
    const m = message?.trim() ? escapeHtml(message.slice(0, 500).trim()) : null;

    const tgText = [
      '📩 <b>Новая заявка с сайта</b>',
      '',
      `👤 <b>Имя:</b> ${n}`,
      `📬 <b>Контакт:</b> ${c}`,
      m ? `💬 <b>Запрос:</b>\n${m}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const emailText = [
      'Новая заявка с сайта',
      '',
      `Имя: ${name.trim()}`,
      `Контакт: ${contact.trim()}`,
      m ? `Запрос:\n${message!.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    this.logger.log('New booking received');

    // Both channels are fire-and-forget — response is instant regardless of
    // Telegram/Resend availability. Email is the fallback if Telegram fails.
    void this.telegram.notifyAdmin(tgText);
    void this.email.sendAdminNotification('📩 Новая заявка с сайта', emailText);

    return { ok: true };
  }
}
