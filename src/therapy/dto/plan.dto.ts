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
import { PlanSourceDto } from './plan-source.dto';
import { ADDRESS_SHAPE, GUIDE_ADDRESS_MAX } from '../guide-mark-address';
import { PLAN_RUBRICS, PLAN_STATUSES } from '../therapy-plan.types';

// Потолки тела запроса: клиентов за один «В план» и пунктов в одном плане.
export const PLAN_CLIENTS_MAX = 50;
export const PLAN_ITEMS_MAX = 200;
const INT32_MAX = 2_147_483_647;

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

  // Фаза пути клиента; только при одном клиенте (сервис проверяет принадлежность).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INT32_MAX)
  phaseId?: number;
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

  // null снимает пункт с фазы пути.
  @ValidateIf((o: UpdatePlanItemDto) => o.phaseId != null)
  @IsInt()
  @Min(1)
  @Max(INT32_MAX)
  phaseId?: number | null;
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
