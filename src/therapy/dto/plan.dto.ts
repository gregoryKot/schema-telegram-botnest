import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PLAN_ITEM_TEXT_MAX } from '../../utils/text-limits';
import { ADDRESS_SHAPE, GUIDE_ADDRESS_MAX } from '../guide-mark-address';
import {
  PLAN_RUBRICS,
  PLAN_SOURCE_KINDS,
  PLAN_STATUSES,
} from '../therapy-plan.types';

// Потолки тела запроса: клиентов за один «В план» и пунктов в одном плане.
export const PLAN_CLIENTS_MAX = 50;
export const PLAN_ITEMS_MAX = 200;
const INT32_MAX = 2_147_483_647;

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

export class CreatePlanItemsDto {
  // Строки цифр, как ClientIdField: минус — у офлайн-клиента.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PLAN_CLIENTS_MAX)
  @ArrayUnique()
  @Matches(/^-?\d{1,19}$/, { each: true })
  clientIds!: string[];

  @IsString()
  @IsIn(PLAN_RUBRICS)
  rubric!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(PLAN_ITEM_TEXT_MAX)
  text!: string;

  // Адрес раздела справочника; вид статьи проверяет сервис (parseGuideAddress).
  @IsOptional()
  @IsString()
  @MaxLength(GUIDE_ADDRESS_MAX)
  @Matches(ADDRESS_SHAPE)
  sourceAddress?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanSourceDto)
  source?: PlanSourceDto;
}

export class UpdatePlanItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(PLAN_ITEM_TEXT_MAX)
  text?: string;

  @IsOptional()
  @IsString()
  @IsIn(PLAN_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(PLAN_RUBRICS)
  rubric?: string;

  // null снимает отметку «выдано заданием».
  @ValidateIf((o: UpdatePlanItemDto) => o.taskId != null)
  @IsInt()
  @Min(1)
  @Max(INT32_MAX)
  taskId?: number | null;
}

export class ReorderPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PLAN_ITEMS_MAX)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(INT32_MAX, { each: true })
  ids!: number[];
}
