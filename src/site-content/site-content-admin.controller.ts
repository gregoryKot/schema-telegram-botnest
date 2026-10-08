import {
  Body,
  Controller,
  Headers,
  Patch,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiteContentService } from './site-content.service';
import { AdminThrottle, assertAdminKey } from '../booking/admin-key.util';
import { HeroPhotoDto, MarqueeDto } from './site-content-admin.dto';

// The global express json() body limit is 256kb (main.ts) — stay well under it,
// the frontend compresses the photo client-side before upload.
const MAX_PHOTO_BYTES = 220 * 1024;

// SVG тоже `image/*`, а внутри него может лежать <script>. Ручка за админ-ключом,
// фото уходит в <img src>, где такой скрипт инертен, — это defense-in-depth
// (находка аудита 2026-07-20, L1), не живая дыра. Список разрешённого, не
// запрещённого: фронт жмёт в JPEG, png/webp про запас. `;` в конце обязательна:
// без неё `data:image/pngx;…` прошло бы как совпадение подстроки.
const RASTER_PHOTO_PREFIXES = [
  'data:image/png;',
  'data:image/jpeg;',
  'data:image/webp;',
];

/** Admin endpoints for hero photo + marquee topics, guarded by ADMIN_BOOKING_KEY. */
@AdminThrottle()
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
    if (!RASTER_PHOTO_PREFIXES.some((p) => body.dataUri?.startsWith(p)))
      throw new BadRequestException('Expected a PNG, JPEG or WebP data URI');
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
