import { IsIn } from 'class-validator';
import { QUICK_PRACTICE_IDS } from '../../bot/practice-sessions.service';
import type { QuickPracticeId } from '../../bot/practice-sessions.service';

/** DTO для POST /api/practice-session (правило №6: рантайм-валидация вместо
 * inline-интерфейса в @Body()). tool — только из allow-list трёх практик. */
export class RecordPracticeSessionDto {
  @IsIn(QUICK_PRACTICE_IDS)
  tool!: QuickPracticeId;
}
