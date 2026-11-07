import { api } from '../../../api';
import { DIARY_QUICK_SAVE_EVENT, type DiaryQuickTag } from '../../../../../shared/src/analytics/homeTile';

/** Событие сохранения записи «Дневника одной страницей»; meta — только тег и «подробно», без текста. */
export function trackQuickSave(tag: DiaryQuickTag, detailed: boolean): void {
  api.trackEvent(DIARY_QUICK_SAVE_EVENT, { tag, detailed });
}
