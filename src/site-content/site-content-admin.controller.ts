import {
  Body,
  Controller,
  Headers,
  Patch,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiteContentService } from './site-content.service';
import { assertAdminKey } from '../booking/admin-key.util';
import { HeroPhotoDto, MarqueeDto } from './site-content-admin.dto';

// The global express json() body limit is 256kb (main.ts) — stay well under it,
// the frontend compresses the photo client-side before upload.
const MAX_PHOTO_BYTES = 220 * 1024;

/** Admin endpoints for hero photo + marquee topics, guarded by ADMIN_BOOKING_KEY. */
@Controller('api/site-content/admin')
export class SiteContentAdminController {
  private readonly adminKey: string;

  constructor(
    private readonly content: SiteContentService,
    private readonly config: ConfigService,
  ) {
    this.adminKey = config.get<string>('ADMIN_BOOKING_KEY') ?? '';
  }

  @Patch('hero-photo')
  async setHeroPhoto(
    @Body() body: HeroPhotoDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    if (!body.dataUri?.startsWith('data:image/'))
      throw new BadRequestException('Expected an image data URI');
    if (body.dataUri.length > MAX_PHOTO_BYTES)
      throw new BadRequestException('Photo too large');
    return this.content.setHeroPhoto(body.dataUri);
  }

  @Patch('marquee')
  async setMarquee(
    @Body() body: MarqueeDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    if (body.topics.some((t) => !t.label?.trim() || !t.href?.trim())) {
      throw new BadRequestException('Invalid topics');
    }
    return this.content.setMarqueeTopics(body.group, body.topics);
  }
}
