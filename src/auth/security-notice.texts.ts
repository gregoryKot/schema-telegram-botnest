// Тексты уведомлений владельцу аккаунта о событиях безопасности (S11/S12,
// аудит 2026-11): привязан или отвязан способ входа, кто-то подбирает код
// 2FA. Один текст на оба канала — письмо (security-notice.service.ts) и
// сообщение бота (renderTemplate, тип `security_notice`): два экземпляра
// одной фразы разъезжаются (правило №4).
import { t, type AddressForm } from '../notification/address-form';

export type SecurityNoticeKind =
  'provider_linked' | 'provider_unlinked' | 'totp_locked';

export interface SecurityNotice {
  kind: SecurityNoticeKind;
  provider?: string;
}

const PROVIDER_NAMES: Record<string, string> = {
  telegram: 'Telegram',
  google: 'Google',
  vk: 'VK ID',
  max: 'MAX',
  email: 'вход по почте',
};

function providerName(id: string | undefined): string {
  if (!id) return 'способ входа';
  return PROVIDER_NAMES[id] ?? id;
}

export function securityNoticeText(
  notice: SecurityNotice,
  form: AddressForm,
): { subject: string; body: string } {
  const p = providerName(notice.provider);
  if (notice.kind === 'provider_linked') {
    return {
      subject: 'Новый способ входа во «Всё по схеме»',
      body: t(
        form,
        `К твоему аккаунту во «Всё по схеме» привязан новый способ входа: ${p}.\n\nЕсли это не ты — открой «Аккаунт» на сайте, отвяжи ${p} и включи двухфакторную защиту.`,
        `К вашему аккаунту во «Всё по схеме» привязан новый способ входа: ${p}.\n\nЕсли это не вы — откройте «Аккаунт» на сайте, отвяжите ${p} и включите двухфакторную защиту.`,
      ),
    };
  }
  if (notice.kind === 'provider_unlinked') {
    return {
      subject: 'Способ входа отвязан от «Всё по схеме»',
      body: t(
        form,
        `От твоего аккаунта во «Всё по схеме» отвязан способ входа: ${p}.\n\nЕсли это не ты — открой «Аккаунт» на сайте и проверь способы входа: у кого-то может быть доступ к твоей сессии.`,
        `От вашего аккаунта во «Всё по схеме» отвязан способ входа: ${p}.\n\nЕсли это не вы — откройте «Аккаунт» на сайте и проверьте способы входа: у кого-то может быть доступ к вашей сессии.`,
      ),
    };
  }
  return {
    subject: 'Кто-то подбирает код двухфакторной защиты',
    body: t(
      form,
      'К твоему аккаунту во «Всё по схеме» за сутки ввели 10 неверных кодов двухфакторной защиты. Коды из приложения-аутентификатора теперь не принимаются до суток, резервные коды работают.\n\nЕсли это не ты — у кого-то есть доступ к твоему первому способу входа. Смени пароль от почты или аккаунта, через который входишь, и проверь способы входа в «Аккаунте».',
      'К вашему аккаунту во «Всё по схеме» за сутки ввели 10 неверных кодов двухфакторной защиты. Коды из приложения-аутентификатора теперь не принимаются до суток, резервные коды работают.\n\nЕсли это не вы — у кого-то есть доступ к вашему первому способу входа. Смените пароль от почты или аккаунта, через который входите, и проверьте способы входа в «Аккаунте».',
    ),
  };
}

/** Сообщение бота из очереди уведомлений (payload строки — SecurityNotice). */
export function renderSecurityNotice(
  payload: Record<string, unknown> | undefined,
  form: AddressForm,
): { text: string } | null {
  const kind = payload?.kind;
  if (
    kind !== 'provider_linked' &&
    kind !== 'provider_unlinked' &&
    kind !== 'totp_locked'
  )
    return null;
  const provider =
    typeof payload?.provider === 'string' ? payload.provider : undefined;
  const { subject, body } = securityNoticeText({ kind, provider }, form);
  return { text: `🔐 ${subject}\n\n${body}` };
}
