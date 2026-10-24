import { PrismaService } from '../prisma/prisma.service';
import { CANONICAL_HOST } from '../infra/canonical-host';
import {
  AddressForm,
  normalizeAddressForm,
  t,
} from '../notification/address-form';
import { isValidEmail } from '../auth/email.util';
import { decryptAuthProviderRow } from '../utils/auth-provider-crypto';
import { escapeHtml } from '../utils/escape-html';

// Адресат решения по заявке на роль терапевта: чем и кому писать.
// Вынесено из therapist-request.notify.ts (правило №10 — лимит размера).
//
// Заявитель — не обязательно человек из Telegram: заявку подают и с сайта,
// где аккаунт заведён через Google/VK/почту, а его userId лежит в веб-диапазоне
// и chat_id не является (инцидент класса #456). Поэтому адрес в Telegram берётся
// из привязки (AccountService.telegramIdsFor), а запасной канал — почта аккаунта.

// Подпись кнопки подачи заявки: страница /account и настройки сайта, настройки
// мини-аппа. Одна подпись на три места (правило №4) — иначе письмо поведёт «не туда».
export const APPLY_BUTTON = 'Я психолог — подать заявку';

export type Decision = 'approved' | 'rejected';
export type Channel = 'tg' | 'email';

export interface DecisionMessage {
  subject: string;
  text: string;
}

/**
 * Единственный источник текста решения для обоих каналов (иначе копия tg/email
 * разъезжается). Рода нет: «заявка одобрена/отклонена». В Telegram причина
 * экранируется (parse_mode HTML), в письме — как есть.
 */
export function decisionMessage(
  form: AddressForm,
  decision: Decision,
  reason: string | undefined,
  channel: Channel,
): DecisionMessage {
  const tg = channel === 'tg';
  const why = reason ? `\n\nПричина: ${tg ? escapeHtml(reason) : reason}` : '';
  if (decision === 'approved') {
    return {
      subject: 'Заявка на роль терапевта одобрена',
      text: tg
        ? t(
            form,
            '✅ Твоя заявка на роль терапевта одобрена. Перезапусти приложение, чтобы увидеть кабинет терапевта.',
            '✅ Ваша заявка на роль терапевта одобрена. Перезапустите приложение, чтобы увидеть кабинет терапевта.',
          )
        : t(
            form,
            `Твоя заявка на роль терапевта одобрена. Кабинет терапевта появится после входа на https://${CANONICAL_HOST}/account`,
            `Ваша заявка на роль терапевта одобрена. Кабинет терапевта появится после входа на https://${CANONICAL_HOST}/account`,
          ),
    };
  }
  const head = t(
    form,
    'Твоя заявка на роль терапевта отклонена.',
    'Ваша заявка на роль терапевта отклонена.',
  );
  // Отказ не тупик: заявку можно подать заново (service.submit пускает при
  // status = rejected). Кнопка с этой подписью есть на всех площадках, откуда
  // заявку подают (пин в спеке по исходникам). Обращения здесь нет — форм две не
  // надо. В письме ссылка стоит последней и без точки после неё: автолинкер
  // почтовика иначе утащит знак препинания в адрес.
  const again = tg
    ? `Подать заявку заново можно в настройках приложения: кнопка «${APPLY_BUTTON}».`
    : `Подать заявку заново можно кнопкой «${APPLY_BUTTON}» на странице https://${CANONICAL_HOST}/account`;
  return {
    subject: 'Заявка на роль терапевта отклонена',
    text: `${tg ? '❌ ' : ''}${head}${why}\n\n${again}`,
  };
}

export interface ApplicantProfile {
  form: AddressForm;
  email: string | null;
}

/**
 * Форма обращения и почта аккаунта — по точному bigint. Порядок почты:
 * вход по почте (providerId и есть адрес, подтверждён ссылкой) → email из
 * OAuth-профиля (Google/VK; в базе лежит шифротекстом — только через
 * decryptAuthProviderRow).
 */
export async function loadApplicantProfile(
  prisma: PrismaService,
  userId: bigint,
): Promise<ApplicantProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { addressForm: true },
  });
  const form = normalizeAddressForm(user?.addressForm);
  const rows = await prisma.authProvider.findMany({
    where: { userId },
    select: { provider: true, providerId: true, email: true },
    orderBy: { id: 'asc' },
  });
  const login = rows.find((r) => r.provider === 'email');
  if (login && isValidEmail(login.providerId)) {
    return { form, email: login.providerId };
  }
  for (const r of rows) {
    const email = decryptAuthProviderRow(r).email;
    if (email && isValidEmail(email)) return { form, email };
  }
  return { form, email: null };
}
