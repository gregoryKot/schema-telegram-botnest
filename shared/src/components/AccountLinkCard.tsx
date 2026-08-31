// Карточка «данные лежат в двух местах» — одна на сайт и на мини-апп
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
  LINK_RETRY,
  type Tr,
} from '../account/accountLinkText';

const SUB: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-sub)',
  lineHeight: 1.6,
};

const TITLE: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 8,
};

const ACTION: React.CSSProperties = {
  marginTop: 12,
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 'var(--r-12)',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

const CODE: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: 2,
  margin: '10px 0',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  color: 'var(--text)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
};

export interface AccountLinkCardProps {
  target: LinkTarget;
  state: LoginTicketState;
  tr: Tr;
  /** Начать привязку. Возвращает адрес подтверждения, если он уже известен. */
  onStart: () => void;
  onRetry: () => void;
  /**
   * Скелетон рисует ФРОНТ: примитив живёт у каждого свой, а shared не имеет
   * права импортировать из webapp/ или schema-miniapp/ — зависимость смотрит
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
    return <div style={SUB}>{LINK_DENIED}</div>;
  }
  if (state.kind === 'expired' || state.kind === 'failed') {
    return (
      <div style={SUB}>
        {LINK_EXPIRED}
        <div>
          <button type="button" onClick={onRetry} style={ACTION}>
            {LINK_RETRY}
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'waiting') {
    return (
      <div>
        <div style={TITLE}>{copy$.title}</div>
        <div style={SUB}>{copy$.waiting}</div>
        <button
          type="button"
          style={CODE}
          onClick={() => void copy(state.code)}
        >
          {formatUserCode(state.code)}
        </button>
        <div style={SUB}>{copied ? LINK_COPIED : LINK_COPY_HINT}</div>
        {/* Полный адрес остаётся текстом: «открыть ещё раз» ходит тем же
            способом, который уже не сработал, и без адреса человек остался бы
            с восьмизначным кодом и без места, куда его ввести. */}
        <div style={{ ...SUB, wordBreak: 'break-all', marginTop: 8 }}>
          {state.url}
        </div>
      </div>
    );
  }

  // Билет уже выписывается — гасим кнопку: второй тап послал бы второй запрос
  // и заново сбросил бы экран в «начинаем». Хук такое наложение переживёт
  // (сверка поколения опроса), но лишний поход в сеть незачем.
  const starting = state.kind === 'starting';
  const actionStyle = starting
    ? { ...ACTION, opacity: 0.6, cursor: 'default', pointerEvents: 'none' }
    : ACTION;
  return (
    <div>
      <div style={TITLE}>{copy$.title}</div>
      <div style={SUB}>{copy$.what}</div>
      <div style={{ ...SUB, marginTop: 8 }}>{copy$.next}</div>
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
          style={actionStyle}
        >
          {copy$.action}
        </a>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          style={actionStyle}
        >
          {copy$.action}
        </button>
      )}
    </div>
  );
}
