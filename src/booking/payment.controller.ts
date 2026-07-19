import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { RobokassaService } from './robokassa.service';
import { BookingService, PaymentAmountMismatchError } from './booking.service';
import { BookingNotifyService } from './booking-notify.service';
import { DonationService } from '../donation/donation.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { normalizeBaseUrl } from '../utils/url';

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

  private readonly appUrl: string;

  constructor(
    private readonly robokassa: RobokassaService,
    private readonly booking: BookingService,
    private readonly notify: BookingNotifyService,
    private readonly donation: DonationService,
    private readonly subscription: SubscriptionService,
    config: ConfigService,
  ) {
    this.siteUrl = normalizeBaseUrl(
      config.get<string>('SITE_URL'),
      'https://kotlarewski.gr',
    );
    this.appUrl = normalizeBaseUrl(
      config.get<string>('APP_URL'),
      'https://schemehappens.ru',
    );
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
    const paidAmount = Number.parseFloat(outSum);
    const paid = Number.isFinite(paidAmount) ? paidAmount : undefined;

    // Subscriptions and donations live in their own InvId ranges and share this
    // one webhook. Check subscriptions first (highest range).
    if (SubscriptionService.isSubscriptionInvId(id)) {
      try {
        await this.subscription.markChargePaidByInvId(id, paid);
      } catch (e) {
        this.logger.error(
          `Subscription mark-paid failed for InvId ${id}: ${(e as Error).message}`,
        );
        return `FAIL${invId}`;
      }
      return `OK${invId}`;
    }
    if (DonationService.isDonationInvId(id)) {
      try {
        await this.donation.markPaidByInvId(id, paid);
      } catch (e) {
        this.logger.error(
          `Donation mark-paid failed for InvId ${id}: ${(e as Error).message}`,
        );
        return `FAIL${invId}`;
      }
      return `OK${invId}`;
    }

    try {
      await this.booking.confirm(id, paid);
    } catch (e) {
      // Amount mismatch is NOT a benign repeat — do not ack money we didn't
      // verify as correct. BookingService.confirm already alerted the admin;
      // FAIL keeps Robokassa retrying/visible instead of silently swallowing
      // a potential fraud/misconfig case (see CLAUDE.md «Аудит-события»).
      if (e instanceof PaymentAmountMismatchError) {
        this.logger.warn(`Confirm booking ${id}: ${(e as Error).message}`);
        return `FAIL${invId}`;
      }
      // Already confirmed/cancelled → benign double-delivery, ack so Robokassa stops.
      if (e instanceof ConflictException) {
        this.logger.warn(`Confirm booking ${id}: ${(e as Error).message}`);
        return `OK${invId}`;
      }
      // Real failure: the client PAID but the booking didn't confirm. Alert loudly
      // and return FAIL so Robokassa retries later.
      this.logger.error(
        `PAID but confirm failed for booking ${id}: ${(e as Error).message}`,
      );
      await this.notify.alertAdmin(
        `🚨 <b>Оплата прошла, но бронь #${id} не подтвердилась</b>\n${(e as Error).message}\nПроверьте вручную в админке.`,
      );
      return `FAIL${invId}`;
    }

    return `OK${invId}`;
  }

  /**
   * Robokassa SuccessURL — the client's browser returns here after paying.
   * We validate the success signature, then send them to a real confirmation
   * page: bookings → /booking/paid?token=… (shows the meeting link), donations →
   * the donate page. Handles both InvId ranges so it works even when a single
   * fixed SuccessURL is configured in the cabinet.
   */
  @Get('success')
  async successRedirect(
    @Query('InvId') invId: string,
    @Query('OutSum') outSum: string,
    @Query('SignatureValue') sig: string,
    @Res() res: Response,
  ) {
    const id = parseInt(invId, 10);
    if (isNaN(id) || !this.robokassa.validateSuccess(outSum, invId, sig)) {
      // Can't trust the InvId — show a generic "payment received" page.
      return res.redirect(`${this.siteUrl}/booking/paid`);
    }
    if (SubscriptionService.isSubscriptionInvId(id)) {
      // The subscribe page reads ?sub=ok; the token came through on our own
      // successUrl, but Robokassa may use the cabinet URL — so add it back.
      return res.redirect(`${this.appUrl}/subscribe?sub=ok`);
    }
    if (DonationService.isDonationInvId(id)) {
      return res.redirect(`${this.appUrl}/donate?donation=ok`);
    }
    try {
      const b = await this.booking.getById(id);
      return res.redirect(
        `${this.siteUrl}/booking/paid?token=${(b as { cancelToken: string }).cancelToken}`,
      );
    } catch {
      return res.redirect(`${this.siteUrl}/booking/paid`);
    }
  }

  /** Robokassa FailURL — redirect back so the user can retry. */
  @Get('fail')
  failRedirect(@Query('InvId') invId: string, @Res() res: Response) {
    const id = parseInt(invId, 10);
    if (!isNaN(id) && SubscriptionService.isSubscriptionInvId(id)) {
      return res.redirect(`${this.appUrl}/subscribe?sub=fail`);
    }
    if (!isNaN(id) && DonationService.isDonationInvId(id)) {
      return res.redirect(`${this.appUrl}/donate?donation=fail`);
    }
    return res.redirect(`${this.siteUrl}/booking/paid?fail=1`);
  }
}
