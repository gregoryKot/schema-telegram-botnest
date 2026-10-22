import { MeetingService } from './meeting.service';
import { ClientKeyRekeyService } from './client-key-rekey.service';

// Провайдеры постоянной комнаты клиента: сама комната и перевод ключей строк
// ClientMeeting на старте (вынесено из booking.registry.ts, правило №10).
export const MEETING_PROVIDERS = [MeetingService, ClientKeyRekeyService];
