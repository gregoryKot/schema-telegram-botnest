import { Module } from '@nestjs/common';
import { SiteContentController } from './site-content.controller';
import { SiteContentAdminController } from './site-content-admin.controller';
import { SiteContentService } from './site-content.service';

@Module({
  controllers: [SiteContentController, SiteContentAdminController],
  providers: [SiteContentService],
})
export class SiteContentModule {}
