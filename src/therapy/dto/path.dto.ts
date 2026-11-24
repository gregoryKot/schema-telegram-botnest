import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDay } from '../../utils/calendar-day';
import {
  PATH_CRITERIA_MAX,
  PATH_PHASES_MAX,
  PATH_PHASE_GOAL_MAX,
  PATH_PHASE_NAME_MAX,
  PATH_PHASE_NOTE_MAX,
  PATH_PHASE_WEEKS_MAX,
  PATH_TEMPLATE_ID_MAX,
} from '../therapy-path.types';

const INT32_MAX = 2_147_483_647;
// id шаблона и его фазы — слаг из shared/src/therapy/path/templates.
const SLUG = /^[a-z0-9][a-z0-9_-]*$/i;

/** Фаза к созданию; сервер шаблонов не знает — проверяет форму и потолки. */
export class PathPhaseDraftDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(PATH_PHASE_NAME_MAX)
  name!: string;

  @ValidateIf((o: PathPhaseDraftDto) => o.goal != null)
  @IsString()
  @MaxLength(PATH_PHASE_GOAL_MAX)
  goal?: string | null;

  @IsInt()
  @Min(1)
  @Max(PATH_PHASE_WEEKS_MAX)
  weeks!: number;

  @ValidateIf((o: PathPhaseDraftDto) => o.templatePhaseId != null)
  @IsString()
  @MaxLength(PATH_TEMPLATE_ID_MAX)
  @Matches(SLUG)
  templatePhaseId?: string | null;
}

export class CreatePathDto {
  @IsString()
  @MaxLength(10)
  @IsCalendarDay()
  startDate!: string;

  @ValidateIf((o: CreatePathDto) => o.templateId != null)
  @IsString()
  @MaxLength(PATH_TEMPLATE_ID_MAX)
  @Matches(SLUG)
  templateId?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PATH_PHASES_MAX)
  @ValidateNested({ each: true })
  @Type(() => PathPhaseDraftDto)
  phases!: PathPhaseDraftDto[];
}

export class UpdatePathDto {
  @IsString()
  @MaxLength(10)
  @IsCalendarDay()
  startDate!: string;
}

export class UpdatePathPhaseDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(PATH_PHASE_NAME_MAX)
  name?: string;

  // null у goal, note и дней стирает значение.
  @ValidateIf((o: UpdatePathPhaseDto) => o.goal != null)
  @IsString()
  @MaxLength(PATH_PHASE_GOAL_MAX)
  goal?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(PATH_PHASE_WEEKS_MAX)
  weeks?: number;

  @ValidateIf((o: UpdatePathPhaseDto) => o.note != null)
  @IsString()
  @MaxLength(PATH_PHASE_NOTE_MAX)
  note?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PATH_CRITERIA_MAX)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(INT32_MAX, { each: true })
  criteriaDone?: number[];

  @ValidateIf((o: UpdatePathPhaseDto) => o.startedAt != null)
  @IsString()
  @MaxLength(10)
  @IsCalendarDay()
  startedAt?: string | null;

  @ValidateIf((o: UpdatePathPhaseDto) => o.endedAt != null)
  @IsString()
  @MaxLength(10)
  @IsCalendarDay()
  endedAt?: string | null;
}

export class AdvancePathPhaseDto {
  @IsString()
  @MaxLength(10)
  @IsCalendarDay()
  date!: string;
}

export class ReorderPathPhasesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PATH_PHASES_MAX)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(INT32_MAX, { each: true })
  ids!: number[];
}
