// Готовые пропсы ShareCardSheet для двух приглашений: в приложение («позвать
// друга») и клиенту от терапевта. Одно место сборки для обоих фронтендов —
// во фронте остаётся только кнопка-триггер (правило №3/№11).
// Ссылка живёт в тексте сообщения, а не на картинке: по картинке не ткнуть.
import { drawInviteCard } from './inviteCard';
import {
  appInviteShareText,
  pairInviteShareText,
  therapistInviteShareText,
  type TherapistInviteLinks,
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

/** Приглашение в приложение без обещаний результата: сайт в тексте, бот (`botLink`) второй строкой. */
export function appInviteShare(botLink: string): InviteSharePayload {
  return {
    title: 'Пригласить друга',
    draw: (canvas) =>
      drawInviteCard(canvas, {
        title: 'Всё по схеме',
        emojis: NEED_EMOJIS,
        hint: 'Трекер пяти базовых эмоциональных потребностей: что за день их наполнило, а что оставило пустым',
      }),
    shareText: appInviteShareText(botLink),
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

/** Приглашение клиенту: карточка объясняет, что за ссылка и код пришли в сообщении. */
export function therapistInviteShare(
  invite: TherapistInviteLinks,
): InviteSharePayload {
  return {
    title: 'Приглашение клиенту',
    draw: (canvas) =>
      drawInviteCard(canvas, {
        title: 'Приглашение от терапевта',
        emojis: ['🤝'],
        hint: 'Ссылка или код из сообщения подключат приложение к терапевту — отметки и записи можно смотреть вместе на сессиях',
      }),
    shareText: therapistInviteShareText(invite),
    filename: 'therapist-invite.png',
    eventKind: 'therapist_invite',
  };
}
