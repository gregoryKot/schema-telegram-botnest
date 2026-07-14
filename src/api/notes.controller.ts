import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid, parseId } from './request-utils';
import { NotesService } from '../bot/notes.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { SchemaNoteDto, ModeNoteDto } from './dto/notes.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Карточки схем/режимов + доступ терапевта к карточкам клиента.
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get('schema-notes')
  async getSchemaNotes(@Req() req: AuthRequest) {
    return this.notesService.getSchemaNotes(uid(req));
  }

  @Post('schema-notes')
  async upsertSchemaNote(@Req() req: AuthRequest, @Body() body: SchemaNoteDto) {
    if (!body.schemaId || typeof body.schemaId !== 'string')
      throw new BadRequestException('schemaId required');
    if (!/^[a-z_]{1,64}$/.test(body.schemaId))
      throw new BadRequestException('invalid schemaId');
    const MAX = 3000;
    const fields = [
      'triggers',
      'feelings',
      'thoughts',
      'origins',
      'reality',
      'healthyView',
      'behavior',
    ] as const;
    for (const f of fields) {
      if (
        body[f] !== undefined &&
        (typeof body[f] !== 'string' || body[f].length > MAX)
      )
        throw new BadRequestException(`${f} too long or invalid`);
    }
    return this.notesService.upsertSchemaNote(uid(req), body.schemaId, {
      triggers: body.triggers?.trim(),
      feelings: body.feelings?.trim(),
      thoughts: body.thoughts?.trim(),
      origins: body.origins?.trim(),
      reality: body.reality?.trim(),
      healthyView: body.healthyView?.trim(),
      behavior: body.behavior?.trim(),
    });
  }

  @Get('mode-notes')
  async getModeNotes(@Req() req: AuthRequest) {
    return this.notesService.getModeNotes(uid(req));
  }

  @Post('mode-notes')
  async upsertModeNote(@Req() req: AuthRequest, @Body() body: ModeNoteDto) {
    if (!body.modeId || typeof body.modeId !== 'string')
      throw new BadRequestException('modeId required');
    if (!/^[a-z_]{1,64}$/.test(body.modeId))
      throw new BadRequestException('invalid modeId');
    const MAX = 3000;
    const fields = [
      'triggers',
      'feelings',
      'thoughts',
      'needs',
      'behavior',
    ] as const;
    for (const f of fields) {
      if (
        body[f] !== undefined &&
        (typeof body[f] !== 'string' || body[f].length > MAX)
      )
        throw new BadRequestException(`${f} too long or invalid`);
    }
    return this.notesService.upsertModeNote(uid(req), body.modeId, {
      triggers: body.triggers?.trim(),
      feelings: body.feelings?.trim(),
      thoughts: body.thoughts?.trim(),
      needs: body.needs?.trim(),
      behavior: body.behavior?.trim(),
    });
  }

  // ── Therapist: client notes ───────────────────────────────────────────────────

  @Get('therapy/client/:clientId/schema-notes')
  async getClientSchemaNotes(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const notes = await this.notesService.getClientSchemaNotes(
      uid(req),
      BigInt(parseId(clientId)),
    );
    if (!notes) throw new BadRequestException('relation not found');
    return notes;
  }

  @Get('therapy/client/:clientId/mode-notes')
  async getClientModeNotes(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const notes = await this.notesService.getClientModeNotes(
      uid(req),
      BigInt(parseId(clientId)),
    );
    if (!notes) throw new BadRequestException('relation not found');
    return notes;
  }
}
