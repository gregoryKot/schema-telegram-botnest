// Shared localStorage key constants – imported wherever needed
export const MY_SCHEMA_IDS_KEY   = 'my_schema_ids';
export const MY_MODE_IDS_KEY     = 'my_mode_ids';
export const CHILDHOOD_DONE_KEY  = 'childhood_wheel_done';
export const YSQ_RESULT_KEY      = 'ysq_result';
export const YSQ_PROGRESS_KEY    = 'ysq_progress';

export function shouldShowChildhoodWheel(): boolean {
  return !localStorage.getItem(CHILDHOOD_DONE_KEY);
}
