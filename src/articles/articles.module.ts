import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesAdminController } from './articles-admin.controller';
import { ArticlesService } from './articles.service';

@Module({
  controllers: [ArticlesController, ArticlesAdminController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
