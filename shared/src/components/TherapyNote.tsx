// Дисклеймер «инструмент — не терапия» с контактом специалиста.
// Единственная копия (правило №3). Сведение 2026-08: канон-текст мини-аппа
// (длинное тире по VOICE), значок чата убран — «отказ от эмодзи» доехал и сюда
// (webapp уже был без них, мини отстал).
import { getTherapistContact } from '../utils/therapistContact';
import { useTr } from '../utils/addressForm';

export function TherapyNote({ compact }: { compact?: boolean }) {
  const contact = getTherapistContact();
  const tr = useTr();

  const linkLabel = contact.isTherapist
    ? tr(
        'Ты специалист — клиенты могут обратиться',
        'Вы специалист — клиенты могут обратиться',
      )
    : contact.name === 'автору'
      ? 'Поговорить с психологом →'
      : `Написать ${contact.name} →`;

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 0',
        }}
      >
        <span
          style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.4 }}
        >
          {contact.isTherapist
            ? tr(
                'Ты работаешь как терапевт — поддержка рядом.',
                'Вы работаете как терапевт — поддержка рядом.',
              )
            : 'Инструмент самоисследования, не замена психологу.'}{' '}
          {!contact.isTherapist && (
            <a
              href={contact.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              {contact.name === 'автору'
                ? 'Записаться →'
                : `Написать ${contact.name} →`}
            </a>
          )}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 12%, transparent)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <div>
        <div
          style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.55 }}
        >
          {contact.isTherapist
            ? tr(
                'Ты работаешь как терапевт. Клиенты обращаются к тебе — ты уже рядом.',
                'Вы работаете как терапевт. Клиенты обращаются к вам — вы уже рядом.',
              )
            : tr(
                'Это инструмент самоисследования — не клиническая диагностика и не замена работе с психологом. Если чувствуешь, что нужно разобраться глубже — терапия — это место, где безопасно.',
                'Это инструмент самоисследования — не клиническая диагностика и не замена работе с психологом. Если чувствуете, что нужно разобраться глубже — терапия — это место, где безопасно.',
              )}
        </div>
        <a
          href={contact.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 6,
            fontSize: 12,
            color: 'var(--accent)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {linkLabel}
        </a>
      </div>
    </div>
  );
}
