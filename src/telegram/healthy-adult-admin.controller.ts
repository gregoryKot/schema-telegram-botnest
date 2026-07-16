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
import { HealthyAdultService } from '../bot/healthy-adult.service';
import { TelegramChannelService } from './telegram.channel.service';
import { assertAdminKey } from '../booking/admin-key.util';
import {
  CreatePhraseDto,
  UpdatePhraseDto,
  TestPostDto,
} from '../bot/healthy-adult.dto';

/**
 * Админ-эндпоинты управления фразами «Здорового Взрослого», защищены тем же
 * ADMIN_BOOKING_KEY, что и вся админка (x-admin-key header). Живёт в
 * TelegramModule, т.к. тестовая публикация ходит через TelegramChannelService.
 */
@Controller('api/healthy-adult/admin')
export class HealthyAdultAdminController {
  private readonly adminKey: string;

  constructor(
    private readonly phrases: HealthyAdultService,
    private readonly channel: TelegramChannelService,
    config: ConfigService,
  ) {
    this.adminKey = config.get<string>('ADMIN_BOOKING_KEY') ?? '';
  }

  @Get('list')
  async list(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.phrases.list();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(
    @Body() dto: CreatePhraseDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.phrases.create(dto.text);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePhraseDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.phrases.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.phrases.remove(id);
  }

  /** Опубликовать фразу в канал прямо сейчас — проверка связки из админки. */
  @Post('test-post')
  @HttpCode(HttpStatus.OK)
  async testPost(
    @Body() dto: TestPostDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.channel.post(dto.slot === 1 ? 1 : 0);
  }
}
