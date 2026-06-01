import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';

interface BookingDto {
  name: string;
  contact: string;
  message?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Controller('api')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(private readonly telegram: TelegramService) {}

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

    const text = [
      '📩 <b>Новая заявка с сайта</b>',
      '',
      `👤 <b>Имя:</b> ${n}`,
      `📬 <b>Контакт:</b> ${c}`,
      m ? `💬 <b>Запрос:</b>\n${m}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    this.logger.log('New booking received');
    await this.telegram.notifyAdmin(text);

    return { ok: true };
  }
}
