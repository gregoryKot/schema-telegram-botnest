import { IsString, Matches, MaxLength } from 'class-validator';
import { NotFutureDay } from './not-future-day';

/**
 * Отметка «Делали сегодня» у техники подсказок (#995, контракт —
 * `ConceptTechniqueMark` в shared/src/apiTypes.ts): id техники и местный день
 * терапевта. Лежит массивом `done` в связи режима или схемы
 * (concept-links.dto.ts). Рабочий журнал терапевта: клиенту не уходит — вид
 * клиента собирает связь без `done` (src/therapy/client-concept-view.ts).
 */
export class ConceptTechniqueMarkDto {
  @IsString()
  @MaxLength(64)
  techniqueId!: string;

  @IsString()
  @MaxLength(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @NotFutureDay()
  day!: string;
}
