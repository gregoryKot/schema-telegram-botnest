import { useCopyToClipboard } from '../utils/useCopyToClipboard';
import { CopyFailedHint } from '../components/CopyFailedHint';
import { INVITE_CODE_HINT } from './therapistLinkCopy';

// Код приглашения отдельной строкой рядом со ссылкой (инцидент 2026-10-26):
// терапевт видел только ссылку t.me, и клиенту, который пользуется сайтом,
// код приходилось вырезать из адреса. Один компонент на все места выдачи
// приглашения — кабинет («Новый клиент», «Ссылка») и «Кабинет терапевта» в
// настройках. Кнопка — тихая обводочная дизайн-системы (ds-btn, CSS сайта).
export const inviteCodeStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 17,
  letterSpacing: '0.08em',
  color: 'var(--text)',
  userSelect: 'all',
  wordBreak: 'break-all',
} as const;

export function InviteCodeBox({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const { copied, failed, copy } = useCopyToClipboard();
  return (
    <div className={className} style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 6 }}>
        Код для ввода вручную
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <code style={inviteCodeStyle}>{code}</code>
        <button
          type="button"
          className="ds-btn ds-btn--sm ds-btn--secondary"
          onClick={() => void copy(code)}
        >
          {copied ? '✓ Код скопирован' : 'Скопировать код'}
        </button>
      </div>
      <CopyFailedHint show={failed} />
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: 'var(--text-faint)',
          margin: '8px 0 0',
        }}
      >
        {INVITE_CODE_HINT}
      </p>
    </div>
  );
}
