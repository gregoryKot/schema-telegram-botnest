// Готовые пропсы ShareCardSheet для двух приглашений: в приложение («позвать
// друга») и клиенту от терапевта. Одно место сборки для обоих фронтендов —
// во фронте остаётся только кнопка-триггер (правило №3/№11).
// Ссылка живёт в тексте сообщения, а не на картинке: по картинке не ткнуть.
import { drawInviteCard } from './inviteCard';
import {
  appInviteShareText,
  pairInviteShareText,
  therapistInviteShareText,
} from '../shareTexts';
import type { ShareCardKind } from '../analytics';

export interface InviteSharePayload {
  title: string;
  draw: (canvas: HTMLCanvasElement) => void;
  shareText: string;
  filename: string;
  eventKind: ShareCardKind;
}

// Эмодзи пяти потребностей — тот же порядок, что в трекере и на радаре.
const NEED_EMOJIS = ['🤝', '🧭', '💬', '🎉', '⚖️'];

/** Приглашение в приложение: чем оно занимается, без обещаний результата. */
export function appInviteShare(link: string): InviteSharePayload {
  return {
    title: 'Пригласить друга',
    draw: (canvas) =>
      drawInviteCard(canvas, {
        title: 'Всё по схеме',
        emojis: NEED_EMOJIS,
        hint: 'Дневник о пяти базовых эмоциональных потребностях: что за день их наполнило, а что оставило пустым',
      }),
    shareText: appInviteShareText(link),
    filename: 'app-invite.png',
    eventKind: 'app_invite',
  };
}

/**
 * Приглашение в пару: код на картинке, deep-link — в тексте. Один конфиг на
 * оба фронтенда (до этого карточка была только в мини-аппе, а на сайте то же
 * приглашение уходило голым текстом).
 */
export function pairInviteShare(
  code: string,
  deepLink: string,
): InviteSharePayload {
  return {
    title: 'Пригласить в пару',
    draw: (canvas) =>
      drawInviteCard(canvas, {
        title: 'Приглашение в пару',
        code,
        hint: 'Ввести этот код в приложении — и отмечать потребности вместе',
      }),
    shareText: pairInviteShareText(code, deepLink),
    filename: 'pair-invite.png',
    eventKind: 'pair_invite',
  };
}

/** Приглашение клиенту: карточка объясняет, что за ссылка пришла в сообщении. */
export function therapistInviteShare(inviteUrl: string): InviteSharePayload {
  return {
    title: 'Приглашение клиенту',
    draw: (canvas) =>
      drawInviteCard(canvas, {
        title: 'Приглашение от терапевта',
        emojis: ['🤝'],
        hint: 'Ссылка в сообщении подключит трекер потребностей — его можно смотреть вместе на сессиях',
      }),
    shareText: therapistInviteShareText(inviteUrl),
    filename: 'therapist-invite.png',
    eventKind: 'therapist_invite',
  };
}
