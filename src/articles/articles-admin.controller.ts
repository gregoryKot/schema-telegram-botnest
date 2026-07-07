import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArticlesService } from './articles.service';
import type { ArticleDto } from './articles.service';
import { assertAdminKey } from '../booking/admin-key.util';

/**
 * Admin article endpoints, guarded by the same ADMIN_BOOKING_KEY used by the
 * booking admin panel (one key for the whole admin panel, x-admin-key header).
 */
@Controller('api/articles/admin')
export class ArticlesAdminController {
  private readonly adminKey: string;

  constructor(
    private readonly articles: ArticlesService,
    private readonly config: ConfigService,
  ) {
    this.adminKey = config.get<string>('ADMIN_BOOKING_KEY') ?? '';
  }

  @Get('list')
  async list(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.articles.adminList();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() dto: ArticleDto, @Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.articles.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<ArticleDto>,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.articles.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.articles.remove(id);
  }
}
