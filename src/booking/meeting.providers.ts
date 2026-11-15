import { MeetingService } from './meeting.service';
import { ClientKeyRekeyService } from './client-key-rekey.service';
import { ForeignScrubCommand } from './foreign-scrub.command';
import { LegacyUidReissueCommand } from './legacy-uid-reissue.command';

// Комната клиента, перевод ключей ClientMeeting на старте и разовые команды
// чистки iCloud/Zoom — /scrub_foreign, /reissue_icloud (правило №10).
export const MEETING_PROVIDERS = [
  MeetingService,
  ClientKeyRekeyService,
  ForeignScrubCommand,
  LegacyUidReissueCommand,
];
