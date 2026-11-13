// Карточка «данные лежат в двух местах» — общая для экранов сайта
// (правило №3 и «одна механика — один компонент»). Механика билета своя не
// заводится: под капотом тот же useLoginTicket, что и у входа, только с
// intent='link' и другой ссылкой подтверждения.
//
// Что карточка обязана сделать ДО первого действия человека (правило
// онбординга): сказать, ОТКУДА взялся второй аккаунт и ЧТО произойдёт после
// нажатия. Без этого «подключить Telegram» читается как непонятное требование.
import type { ReactNode } from 'react';
import type { LoginTicketState } from '../auth/useLoginTicket';
import { formatUserCode } from '../auth/loginTicketCode';
import { useCopyToClipboard } from '../utils/useCopyToClipboard';
import type { LinkTarget } from '../account/linkTarget';
import {
  buildAccountLinkText,
  LINK_COPIED,
  LINK_COPY_HINT,
  LINK_DENIED,
  LINK_EXPIRED,
  LINK_FAILED,
  LINK_RETRY,
  type Tr,
} from '../account/accountLinkText';

// Вид — классы alc-* (webapp/src/styles/auth-account.css), а не инлайн-стили: shared не
// импортирует CSS, стили лежат у сайта, как у NeedsWheel (history.css). Действие — общая
// залитая кнопка ds-btn: на /account она одна (docs/design/APP_2026-11.md, b27).

export interface AccountLinkCardProps {
  target: LinkTarget;
  state: LoginTicketState;
  tr: Tr;
  /** Начать привязку. Возвращает адрес подтверждения, если он уже известен. */
  onStart: () => void;
  onRetry: () => void;
  /**
   * Скелетон рисует ФРОНТ: примитив живёт у каждого свой, а shared не имеет
   * права импортировать из webapp — зависимость смотрит
   * в другую сторону.
   */
  renderSkeleton?: () => ReactNode;
  /** Провайдеры ещё грузятся — показываем силуэт, а не пустоту и не спиннер. */
  loading?: boolean;
  /** Готовая ссылка: на сайте кнопка обязана быть настоящим <a>. */
  href?: string;
}

export function AccountLinkCard({
  target,
  state,
  tr,
  onStart,
  onRetry,
  renderSkeleton,
  loading = false,
  href,
}: AccountLinkCardProps) {
  const { copied, copy } = useCopyToClipboard();
  if (loading) return <>{renderSkeleton?.()}</>;
  if (!target) return null;
  const copy$ = buildAccountLinkText(tr, target);

  if (state.kind === 'denied') {
    return <div className="alc-sub">{LINK_DENIED}</div>;
  }
  if (state.kind === 'expired' || state.kind === 'failed') {
    return (
      <div className="alc-sub">
        {state.kind === 'failed' ? LINK_FAILED : LINK_EXPIRED}
        <div>
          <button type="button" onClick={onRetry} className="ds-btn alc-action">
            {LINK_RETRY}
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'waiting') {
    return (
      <div>
        <div className="alc-title">{copy$.title}</div>
        <div className="alc-sub">{copy$.waiting}</div>
        <button
          type="button"
          className="alc-code"
          onClick={() => void copy(state.code)}
        >
          {formatUserCode(state.code)}
        </button>
        <div className="alc-sub">{copied ? LINK_COPIED : LINK_COPY_HINT}</div>
        {/* Полный адрес остаётся текстом: «открыть ещё раз» ходит тем же
            способом, который уже не сработал, и без адреса человек остался бы
            с восьмизначным кодом и без места, куда его ввести. */}
        <div className="alc-sub alc-url">{state.url}</div>
      </div>
    );
  }

  // Билет уже выписывается — гасим кнопку: второй тап послал бы второй запрос
  // и заново сбросил бы экран в «начинаем». Хук такое наложение переживёт
  // (сверка поколения опроса), но лишний поход в сеть незачем.
  const starting = state.kind === 'starting';
  const actionClass = starting
    ? 'ds-btn alc-action is-starting'
    : 'ds-btn alc-action';
  return (
    <div>
      <div className="alc-title">{copy$.title}</div>
      <div className="alc-sub">{copy$.what}</div>
      <div className="alc-sub alc-next">{copy$.next}</div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (starting) {
              e.preventDefault();
              return;
            }
            onStart();
          }}
          aria-disabled={starting}
          className={actionClass}
        >
          {copy$.action}
        </a>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className={actionClass}
        >
          {copy$.action}
        </button>
      )}
    </div>
  );
}
