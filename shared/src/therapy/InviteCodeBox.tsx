import { useCopyToClipboard } from '../utils/useCopyToClipboard';
import { CopyFailedHint } from '../components/CopyFailedHint';
import { INVITE_CODE_HINT } from './therapistLinkCopy';

// Код приглашения отдельной строкой рядом со ссылкой (инцидент 2026-10-26):
// терапевт видел только ссылку t.me, и клиенту, который пользуется сайтом,
// код приходилось вырезать из адреса. Один компонент на все места выдачи
// приглашения — кабинет («Новый клиент», «Ссылка») и «Кабинет терапевта» в
// настройках, на сайте и в мини-аппе. Цвета — токены, общие для обоих.
export const inviteButtonStyle = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 10,
  border: 'none',
  background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
} as const;

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
          onClick={() => void copy(code)}
          style={inviteButtonStyle}
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
