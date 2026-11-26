// Что показать на экране-согласии по ссылке-приглашению (JoinConfirmSheet
// обоих фронтендов, правило №3). QA 2026-11 (М1), пограничные состояния:
// - ссылка, по которой человек уже подключился к этому терапевту, звучала как
//   «больше не действует… попросите новую», хотя связь есть;
// - при подключении к другому терапевту окно звало «Присоединиться» и только
//   после нажатия (409) говорило, что не выйдет;
// - у недействительной ссылки был заголовок согласия «Открыть доступ
//   терапевту?» и весь его текст, а ошибка — внизу.
// Теперь согласие показывается, только когда присоединиться можно; иначе —
// свой заголовок и одна понятная причина вместо согласия.
import { joinConfirmExplain, joinConfirmTitle } from './joinConfirmCopy';
import { inviteInvalidText, type Tr } from './therapistLinkCopy';
import type { InvitePreview } from './useInvitePreview';

export interface JoinSheetView {
  title: string;
  /** Текст согласия — только когда присоединиться можно. */
  explain: string | null;
  /** Причина вместо согласия; `alert` — сбой, `status` — всё в порядке. */
  notice: { text: string; role: 'alert' | 'status' } | null;
  canJoin: boolean;
  closeLabel: string;
}

export const JOIN_SAME_TEXT =
  'Подключение к этому терапевту уже есть — новая ссылка не нужна. Что видит терапевт, меняется в настройках, раздел «Мой терапевт».';

export function joinOtherTherapistText(tr: Tr): string {
  return tr(
    'У тебя уже есть подключение к другому терапевту. Чтобы перейти к этому, сначала отключись в настройках, раздел «Мой терапевт», а потом открой ссылку снова.',
    'У вас уже есть подключение к другому терапевту. Чтобы перейти к этому, сначала отключитесь в настройках, раздел «Мой терапевт», а затем откройте ссылку снова.',
  );
}

export function joinSheetView(
  isPair: boolean,
  preview: InvitePreview,
  tr: Tr,
): JoinSheetView {
  if (!isPair && preview.state === 'invalid')
    return {
      title: 'Ссылка не действует',
      explain: null,
      notice: { text: inviteInvalidText(tr), role: 'alert' },
      canJoin: false,
      closeLabel: 'Закрыть',
    };
  if (!isPair && preview.state === 'ok' && preview.connection === 'same')
    return {
      title: 'Подключение уже есть',
      explain: null,
      notice: { text: JOIN_SAME_TEXT, role: 'status' },
      canJoin: false,
      closeLabel: 'Понятно',
    };
  if (!isPair && preview.state === 'ok' && preview.connection === 'other')
    return {
      title: 'Есть другой терапевт',
      explain: null,
      notice: { text: joinOtherTherapistText(tr), role: 'alert' },
      canJoin: false,
      closeLabel: 'Закрыть',
    };
  return {
    title: joinConfirmTitle(isPair),
    explain: joinConfirmExplain(isPair, tr),
    notice: null,
    canJoin: true,
    closeLabel: 'Не сейчас',
  };
}
