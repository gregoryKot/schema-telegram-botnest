import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { uid } from './request-utils';
import { NotesService } from '../bot/notes.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { SchemaNoteDto, ModeNoteDto, NoteFieldsDto } from './dto/notes.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Общие поля уже провалидированы DTO (@IsString/@MaxLength) — здесь только trim.
function trimFields(body: NoteFieldsDto) {
  return {
    triggers: body.triggers?.trim(),
    feelings: body.feelings?.trim(),
    thoughts: body.thoughts?.trim(),
    origins: body.origins?.trim(),
    healthyView: body.healthyView?.trim(),
    behavior: body.behavior?.trim(),
  };
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
    return this.notesService.upsertSchemaNote(uid(req), body.schemaId, {
      ...trimFields(body),
      reality: body.reality?.trim(),
    });
  }

  @Get('mode-notes')
  async getModeNotes(@Req() req: AuthRequest) {
    return this.notesService.getModeNotes(uid(req));
  }

  @Post('mode-notes')
  async upsertModeNote(@Req() req: AuthRequest, @Body() body: ModeNoteDto) {
    return this.notesService.upsertModeNote(
      uid(req),
      body.modeId,
      {
        ...trimFields(body),
        needs: body.needs?.trim(),
        modeFunction: body.modeFunction?.trim(),
        needsMet: body.needsMet?.trim(),
        alias: body.alias?.trim(),
        fear: body.fear?.trim(),
      },
      body.fillIfEmpty,
    );
  }
}
// Маршруты therapy/client/:clientId/{schema,mode}-notes здесь были дублем
// therapy.controller (аудит 2026-07: жили обе реализации, отвечала therapy-
// версия, а therapistShareCards уважала только эта, мёртвая). Оставлена одна
// реализация в therapy.controller + privacy-проверка в client-data.service.
