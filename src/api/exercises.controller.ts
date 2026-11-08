import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid, parseId } from './request-utils';
import { ExercisesService } from '../bot/exercises.service';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import {
  BeliefCheckDto,
  LetterDto,
  SafePlaceDto,
  FlashcardDto,
} from './dto/tools.dto';

const id32 = (raw: string) => parseId(raw, { int32: true });

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Инструменты дневника: проверка убеждений, письма, безопасное место,
// флешкарты — самостоятельные user-owned упражнения без общей схемы.
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class ExercisesController {
  constructor(
    private readonly exercisesService: ExercisesService,
    private readonly healthyAdult: HealthyAdultService,
  ) {}

  // ── Фраза Здорового Взрослого ────────────────────────────────────────────────
  // Случайная фраза поддержки из включённого пула (тот же, что постит канал).
  // Свободного текста от юзера нет — только готовый контент.
  @Get('healthy-phrase')
  async getHealthyPhrase(): Promise<{ text: string | null }> {
    const pool = await this.healthyAdult.enabledTexts();
    if (pool.length === 0) return { text: null };
    return { text: pool[Math.floor(Math.random() * pool.length)] };
  }

  // ── Belief checks ─────────────────────────────────────────────────────────────

  @Get('belief-checks')
  getBeliefChecks(@Req() req: AuthRequest) {
    return this.exercisesService.getBeliefChecks(uid(req));
  }

  @Post('belief-checks')
  async createBeliefCheck(
    @Req() req: AuthRequest,
    @Body() body: BeliefCheckDto,
  ) {
    return this.exercisesService.createBeliefCheck(uid(req), {
      belief: body.belief.trim(),
      evidenceFor: body.evidenceFor.map((s) => s.trim()).filter(Boolean),
      evidenceAgainst: body.evidenceAgainst
        .map((s) => s.trim())
        .filter(Boolean),
      reframe: body.reframe?.trim() || undefined,
    });
  }

  // Одна запись по id — её открывает «Мой путь» (R6: в списке только 30).
  @Get('belief-checks/:id')
  getBeliefCheck(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.exercisesService.getBeliefCheck(uid(req), id32(id));
  }

  @Delete('belief-checks/:id')
  deleteBeliefCheck(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.exercisesService.deleteBeliefCheck(uid(req), id32(id));
  }

  // ── Letters ───────────────────────────────────────────────────────────────────

  @Get('letters')
  getLetters(@Req() req: AuthRequest) {
    return this.exercisesService.getLetters(uid(req));
  }

  @Get('letters/:id')
  getLetter(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.exercisesService.getLetter(uid(req), id32(id));
  }

  @Post('letters')
  async createLetter(@Req() req: AuthRequest, @Body() body: LetterDto) {
    if (!body.text) throw new BadRequestException('invalid text');
    return this.exercisesService.createLetter(uid(req), body.text.trim());
  }

  @Patch('letters/:id')
  async updateLetter(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: LetterDto,
  ) {
    const text = body.text?.trim();
    if (!text) throw new BadRequestException('invalid text');
    return this.exercisesService.updateLetter(uid(req), id32(id), text);
  }

  @Delete('letters/:id')
  deleteLetter(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.exercisesService.deleteLetter(uid(req), id32(id));
  }

  // ── Safe place ────────────────────────────────────────────────────────────────

  @Get('safe-place')
  getSafePlace(@Req() req: AuthRequest) {
    return this.exercisesService.getSafePlace(uid(req));
  }

  @Post('safe-place')
  async upsertSafePlace(@Req() req: AuthRequest, @Body() body: SafePlaceDto) {
    if (!body.description) throw new BadRequestException('invalid description');
    return this.exercisesService.upsertSafePlace(
      uid(req),
      body.description.trim(),
    );
  }

  // ── Flashcards ────────────────────────────────────────────────────────────────

  @Get('flashcards')
  getFlashcards(@Req() req: AuthRequest) {
    return this.exercisesService.getFlashcards(uid(req));
  }

  @Post('flashcards')
  async createFlashcard(@Req() req: AuthRequest, @Body() body: FlashcardDto) {
    if (!body.modeId || !/^[a-z_]{1,64}$/.test(body.modeId))
      throw new BadRequestException('invalid modeId');
    if (!body.needId) throw new BadRequestException('invalid needId');
    return this.exercisesService.createFlashcard(uid(req), {
      modeId: body.modeId,
      needId: body.needId,
      reflection: body.reflection?.trim() || undefined,
      action: body.action?.trim() || undefined,
    });
  }

  @Get('flashcards/:id')
  getFlashcard(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.exercisesService.getFlashcard(uid(req), id32(id));
  }

  @Delete('flashcards/:id')
  deleteFlashcard(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.exercisesService.deleteFlashcard(uid(req), id32(id));
  }
}
