import { Controller, Get } from '@nestjs/common';
import { SiteContentService } from './site-content.service';

/** Public read-only endpoint for hero photo + marquee topics. */
@Controller('api/site-content')
export class SiteContentController {
  constructor(private readonly content: SiteContentService) {}

  @Get()
  async get() {
    return this.content.getPublicContent();
  }
}
