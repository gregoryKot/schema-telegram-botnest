import { Chip } from './Chip';
import {
  CONTACT_CHANNELS, contactChannelLabel, contactPlaceholder, telegramNumberHint,
  type ContactChannel,
} from '../../../../shared/src/booking/contactChannel';

interface Props {
  id: string;
  channel: ContactChannel;
  onChannelChange: (c: ContactChannel) => void;
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  onFocus?: () => void;
  invalid?: boolean;
  /** Подсказка валидации (красная) — перекрывает подсказку про Telegram. */
  hint?: string | null;
  labelStyle: React.CSSProperties;
  fieldStyle: React.CSSProperties;
}

/**
 * Поле «Где вам удобнее отвечать»: чипы канала + ввод контакта. Одно на обе
 * формы визитки (простая заявка и слоты) — правило «одна механика — один
 * компонент». Владелец за границей, звонить на российские номера не может,
 * поэтому посетитель сам выбирает мессенджер.
 */
export function ContactChannelField({
  id, channel, onChannelChange, value, onChange, inputRef, onFocus, invalid, hint, labelStyle, fieldStyle,
}: Props) {
  const tgHint = telegramNumberHint(channel, value);
  const note = hint || tgHint;
  return (
    <div>
      <label style={labelStyle} htmlFor={id}>Где вам удобнее отвечать *</label>
      <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', marginBottom: 'var(--space-10)' }}>
        {CONTACT_CHANNELS.map((c) => (
          <Chip key={c} active={c === channel} onClick={() => onChannelChange(c)}>{contactChannelLabel(c)}</Chip>
        ))}
      </div>
      <input
        id={id} ref={inputRef} className="ym-disable-keys" style={fieldStyle} placeholder={contactPlaceholder(channel)}
        value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} required maxLength={100}
        aria-invalid={invalid || undefined} aria-describedby={note ? `${id}-hint` : undefined}
      />
      {note && (
        <p id={`${id}-hint`} style={{ fontSize: 12, color: hint ? 'var(--accent-red)' : 'var(--text-faint)', margin: '6px 0 0' }}>{note}</p>
      )}
    </div>
  );
}
