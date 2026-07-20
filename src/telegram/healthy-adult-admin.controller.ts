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
  ImportPhrasesDto,
  UpdatePhraseDto,
} from '../bot/healthy-adult.dto';
import { formatImportReport } from '../bot/healthy-adult.import';

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

  /**
   * Добавить пачку фраз списком (по одной на строку). Отчёт возвращаем
   * текстом: сколько добавлено и что отсеялось с причиной.
   */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async import(
    @Body() dto: ImportPhrasesDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    const { created, report } = await this.phrases.importMany(dto.text);
    return { created, message: formatImportReport(report) };
  }

  /** Остаток пула — на сколько дней хватит неповторённых фраз. */
  @Get('pool-status')
  async poolStatus(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.phrases.poolStatus();
  }

  /** Опубликовать сообщение в канал прямо сейчас — проверка связки из админки. */
  @Post('test-post')
  @HttpCode(HttpStatus.OK)
  async testPost(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.channel.post();
  }
}
