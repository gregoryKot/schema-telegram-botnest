import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PersistentThrottle } from '../api/persistent-throttle.decorator';
import { DonationService } from './donation.service';
import { DonateDto } from './donation.dto';

@Controller('api/donation')
export class DonationController {
  constructor(private readonly donation: DonationService) {}

  /** POST /api/donation — create a donation, returns { paymentUrl } to redirect to. */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 20, ttl: 3_600_000 } })
  @PersistentThrottle()
  async donate(@Body() dto: DonateDto) {
    if (dto.website) throw new BadRequestException('rejected'); // honeypot
    const { amount, source, email, comment } = dto;
    return this.donation.create({ amount, source, email, comment });
  }
}
