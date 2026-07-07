import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DonationService } from './donation.service';

interface DonateDto {
  amount: number;
  source?: 'app' | 'game';
  email?: string;
  comment?: string;
  website?: string; // honeypot
}

@Controller('api/donation')
export class DonationController {
  constructor(private readonly donation: DonationService) {}

  /** POST /api/donation — create a donation, returns { paymentUrl } to redirect to. */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 20, ttl: 3_600_000 } })
  async donate(@Body() dto: DonateDto) {
    if (dto.website) throw new BadRequestException('rejected'); // honeypot
    return this.donation.create({
      amount: dto.amount,
      source: dto.source,
      email: dto.email,
      comment: dto.comment,
    });
  }
}
