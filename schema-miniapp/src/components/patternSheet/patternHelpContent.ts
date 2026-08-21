// Резолверы контента блока «Что поможет» — чистые функции без React, чтобы
// PatternHelpSection.tsx оставался тонким рендером (правило №10 CLAUDE.md).
// Ничего не пишется заново (правило «одна механика — один компонент»): голос
// Здорового Взрослого и фолбэк-цепочка — shared/src/mode/healthyAdultHints.ts,
// совет по схеме — ysqSchemasContent.ts (через ysqSchemas.ts), потребность —
// shared/src/needs/needData.ts. Здесь только склейка уже выверенного контента.
import { healthyAdultHint } from '../../../../shared/src/mode/healthyAdultHints';
import { getModeCard } from '../../../../shared/src/mode/modeCards';
import {
  getYsqSchemas,
  SCHEMA_NAME_TO_ID,
} from '../../../../shared/src/hooks/ysqSchemas';
import { getNeedData } from '../../../../shared/src/needs/needData';
import type { AddressForm } from '../../../../shared/src/utils/addressForm';

// SCHEMA_NAME_TO_ID хранит name → id (нужен для дельты «изменилось с прошлого
// прохождения»); PatternSheet приходит с id, поэтому здесь обратный поиск.
const ID_TO_SCHEMA_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(SCHEMA_NAME_TO_ID).map(([name, schemaId]) => [schemaId, name]),
);

export interface ModeHelpContent {
  /** Голос Здорового Взрослого — карточка режима → семья теста → нейтральный
   *  дефолт (цепочку не переигрываем, см. healthyAdultHints.ts). */
  adultText: string;
  /** Свободный текст «какая потребность стоит под режимом», null — карточки
   *  режима ещё нет (не должно случаться на 35 канонических режимах, но
   *  чужой/будущий id не обязан её иметь). */
  needText: string | null;
}

export function resolveModeHelp(modeId: string): ModeHelpContent {
  return {
    adultText: healthyAdultHint(modeId),
    needText: getModeCard(modeId)?.need ?? null,
  };
}

export interface SchemaHelpContent {
  /** Совет пользователю после прохождения теста, разведён по форме обращения. */
  tip: string | null;
  needName: string | null;
  /** Короткая строка-описание потребности (NeedExtra.desc). */
  needLine: string | null;
}

export function resolveSchemaHelp(
  schemaId: string,
  form: AddressForm,
): SchemaHelpContent {
  const name = ID_TO_SCHEMA_NAME[schemaId];
  const schema = name
    ? getYsqSchemas(form).find((s) => s.name === name)
    : undefined;
  const need = schema ? getNeedData(form)[schema.needId] : undefined;
  return {
    tip: schema?.tip ?? null,
    needName: need?.name ?? null,
    needLine: need?.desc ?? null,
  };
}
