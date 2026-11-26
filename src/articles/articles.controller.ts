import { Controller, Get, Param } from '@nestjs/common';
import { ArticlesService } from './articles.service';

/** Public read-only endpoints for the site's articles section. */
@Controller('api/articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  async list() {
    return this.articles.list();
  }

  @Get(':slug')
  async get(@Param('slug') slug: string) {
    return this.articles.findBySlug(slug);
  }
}
