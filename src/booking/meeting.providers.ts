import { MeetingService } from './meeting.service';
import { ClientKeyRekeyService } from './client-key-rekey.service';
import { ForeignScrubCommand } from './foreign-scrub.command';

// Провайдеры постоянной комнаты клиента: сама комната и перевод ключей строк
// ClientMeeting на старте, разовая чистка Zoom/iCloud /scrub_foreign (правило №10).
export const MEETING_PROVIDERS = [
  MeetingService,
  ClientKeyRekeyService,
  ForeignScrubCommand,
];
