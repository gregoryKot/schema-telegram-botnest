import 'reflect-metadata';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  WORK_CUSTOM_NAME_MAX,
  WORK_ID_MAX,
  WORK_IDS_MAX,
  WORK_VALUE_MAX,
} from '../session-work';
import { StringsWithin } from './strings-within';

const IdList = (): PropertyDecorator => (target, key) => {
  IsOptional()(target, key);
  IsArray()(target, key);
  ArrayMaxSize(WORK_IDS_MAX)(target, key);
  IsString({ each: true })(target, key);
  MaxLength(WORK_ID_MAX, { each: true })(target, key);
};

/**
 * Пункт «Что делали» в итогах сессии (контракт — `SessionWorkItem` в
 * shared/src/therapy/sessionWork/types.ts). DTO держит форму и границы;
 * незнакомый вид, технику и ключ поля отбрасывает `normalizeSessionWork`.
 */
export class SessionWorkItemDto {
  @IsString()
  @MaxLength(WORK_ID_MAX)
  id!: string;

  @IsIn(['technique', 'exercise', 'custom'])
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORK_ID_MAX)
  refId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORK_CUSTOM_NAME_MAX)
  customName?: string;

  @IdList()
  modeIds?: string[];

  @IdList()
  schemaIds?: string[];

  @IdList()
  needIds?: string[];

  // Ключи сверяет каталог; здесь — только потолок длины ключа и значения.
  @IsOptional()
  @IsObject()
  @StringsWithin(WORK_VALUE_MAX)
  fields?: Record<string, string>;
}
