import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { RobokassaService } from './robokassa.service';
import { BookingService } from './booking.service';
import { BookingNotifyService } from './booking-notify.service';

/**
 * Robokassa payment lifecycle endpoints.
 *
 * POST /api/payment/result   — Robokassa ResultURL webhook (confirms booking)
 * GET  /api/payment/success  — Robokassa SuccessURL redirect
 * GET  /api/payment/fail     — Robokassa FailURL redirect
 */
@Controller('api/payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);
  private readonly siteUrl: string;

  constructor(
    private readonly robokassa: RobokassaService,
    private readonly booking: BookingService,
    private readonly notify: BookingNotifyService,
    config: ConfigService,
  ) {
    this.siteUrl = (config.get<string>('SITE_URL') ?? 'https://schemalab.ru').replace(/\/$/, '');
  }

  /**
   * Robokassa calls this endpoint when payment succeeds.
   * Must respond with the literal string "OK{InvId}" — any other response
   * makes Robokassa retry the notification.
   */
  @Post('result')
  @HttpCode(HttpStatus.OK)
  async handleResult(
    @Body('OutSum') outSum: string,
    @Body('InvId') invId: string,
    @Body('SignatureValue') sig: string,
  ): Promise<string> {
    this.logger.log(`Payment webhook InvId=${invId} OutSum=${outSum}`);

    if (!this.robokassa.validateWebhook(outSum, invId, sig)) {
      // Stable message text so AlertLogger's per-message throttle dedupes bot noise.
      this.logger.error('Robokassa webhook: invalid signature');
      return `FAIL${invId}`;
    }

    const id = parseInt(invId, 10);
    if (isNaN(id)) return `FAIL${invId}`;

    try {
      await this.booking.confirm(id);
    } catch (e) {
      // Already confirmed/cancelled → benign double-delivery, ack so Robokassa stops.
      if (e instanceof ConflictException) {
        this.logger.warn(`Confirm booking ${id}: ${(e as Error).message}`);
        return `OK${invId}`;
      }
      // Real failure: the client PAID but the booking didn't confirm. Alert loudly
      // and return FAIL so Robokassa retries later.
      this.logger.error(`PAID but confirm failed for booking ${id}: ${(e as Error).message}`);
      await this.notify.alertAdmin(
        `🚨 <b>Оплата прошла, но бронь #${id} не подтвердилась</b>\n${(e as Error).message}\nПроверьте вручную в админке.`,
      );
      return `FAIL${invId}`;
    }

    return `OK${invId}`;
  }

  /** Robokassa SuccessURL — redirect to the booking section with confirmed state. */
  @Get('success')
  successRedirect(@Res() res: Response) {
    res.redirect(`${this.siteUrl}/#booking?payment=ok`);
  }

  /** Robokassa FailURL — redirect back so the user can retry. */
  @Get('fail')
  failRedirect(@Res() res: Response) {
    res.redirect(`${this.siteUrl}/#booking?payment=fail`);
  }
}
