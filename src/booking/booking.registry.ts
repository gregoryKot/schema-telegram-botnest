import { BookingController } from './booking.controller';
import { BookingAdminController } from './booking-admin.controller';
import { BookingCalendarAdminController } from './booking-calendar-admin.controller';
import { PaymentController } from './payment.controller';
import { BookingService } from './booking.service';
import { BookingNotifyService } from './booking-notify.service';
import { SlotService } from './slot.service';
import { AvailabilityService } from './availability.service';
import { SlotOverrideService } from './slot-override.service';
import { AdminCalendarService } from './admin-calendar.service';
import { CalDavService } from './caldav.service';
import { MeetingService } from './meeting.service';
import { RobokassaService } from './robokassa.service';
import { PricingService } from './pricing.service';
import { DonationController } from '../donation/donation.controller';
import { DonationService } from '../donation/donation.service';
import { SubscriptionController } from '../subscription/subscription.controller';
import { SubscriptionService } from '../subscription/subscription.service';

// Реестр controllers/providers BookingModule — вынесен из booking.module.ts
// (бейслайн 43 строки, правило №10) отдельно от imports/exports модуля,
// которые остаются в самом модуле.
export const BOOKING_CONTROLLERS = [
  BookingController,
  BookingAdminController,
  BookingCalendarAdminController,
  PaymentController,
  DonationController,
  SubscriptionController,
];

export const BOOKING_PROVIDERS = [
  BookingService,
  BookingNotifyService,
  SlotService,
  AvailabilityService,
  SlotOverrideService,
  AdminCalendarService,
  CalDavService,
  MeetingService,
  RobokassaService,
  PricingService,
  DonationService,
  SubscriptionService,
];
