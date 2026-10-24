import type { Ref } from 'react';

interface Props {
  checked: boolean;
  invalid: boolean;
  inputRef: Ref<HTMLInputElement>;
  onChange: (checked: boolean) => void;
}

export const CONFIRM_NOTICE_HINT = 'Отметьте, что прочитали про подтверждение';

/** Плашка про личное подтверждение бесплатного знакомства + обязательная галочка «понятно». */
export function IntroConfirmNotice({ checked, invalid, inputRef, onChange }: Props) {
  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: 'var(--r-12)',
        padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
        Знакомство бесплатное, поэтому каждую запись подтверждаю лично – свяжусь с вами по контакту, который вы
        оставите. Проверьте, что по нему до вас можно достучаться. Не получили подтверждения за 3 часа до
        встречи – напишите мне сами: <a href="https://t.me/kotlarewski" className="u-accent">@kotlarewski</a>.
        Без подтверждения встреча не состоится.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', cursor: 'pointer', minHeight: 44 }}>
        <input
          type="checkbox" ref={inputRef} checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ flexShrink: 0, accentColor: 'var(--accent)', width: 18, height: 18 }}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'bp-confirm-hint' : undefined}
        />
        <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
          Понятно: встреча состоится только после подтверждения
        </span>
      </label>
      {invalid && (
        <p id="bp-confirm-hint" style={{ fontSize: 12, color: 'var(--accent-red)', margin: 0 }}>{CONFIRM_NOTICE_HINT}</p>
      )}
    </div>
  );
}
