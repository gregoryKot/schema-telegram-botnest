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
import { RobokassaService } from './robokassa.service';
import { BookingService } from './booking.service';

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
      this.logger.warn(`Invalid Robokassa signature for InvId=${invId}`);
      return `FAIL${invId}`;
    }

    const id = parseInt(invId, 10);
    if (isNaN(id)) return `FAIL${invId}`;

    try {
      await this.booking.confirm(id);
    } catch (e) {
      // booking.confirm throws ConflictException if already confirmed — idempotent
      this.logger.warn(`Confirm booking ${id}: ${(e as Error).message}`);
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
