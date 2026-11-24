import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { PLAN_SOURCE_KINDS } from '../therapy-plan.types';

/** Старый источник (клиент до адресов #1484): статья справочника и её поле. */
export class PlanSourceDto {
  @IsString()
  @IsIn(PLAN_SOURCE_KINDS)
  kind!: string;

  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9_]+$/i)
  id!: string;

  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9_]+$/i)
  field!: string;
}
