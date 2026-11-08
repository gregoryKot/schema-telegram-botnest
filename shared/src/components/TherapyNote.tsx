// Дисклеймер «инструмент — не терапия» с контактом специалиста.
// Единственная копия (правило №3). Сведение 2026-08: канон-текст мини-аппа
// (длинное тире по VOICE), значок чата убран — «отказ от эмодзи» доехал и сюда
// (webapp уже был без них, мини отстал).
import { getTherapistContact } from '../utils/therapistContact';
import { useTr } from '../utils/addressForm';

// Ссылки ниже были 74×16 (QA мобильной версии 2026-11, М1): зона нажатия 44 по
// высоте — отступом 14px; у строчной он не раздвигает строку, у блочной это
// делает отрицательный margin. Компактная — ds-link в строке текста, кегль строки.
export function TherapyNote({ compact }: { compact?: boolean }) {
  const contact = getTherapistContact();
  const tr = useTr();

  const linkLabel = contact.isTherapist
    ? tr(
        'Ты специалист — клиенты могут обратиться',
        'Вы специалист — клиенты могут обратиться',
      )
    : contact.name === 'автору'
      ? 'Записаться на консультацию →'
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
          {!contact.isTherapist && contact.url && (
            <a
              href={contact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ds-link ds-link--inline"
              style={{ padding: '14px 0', fontSize: 'inherit' }}
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
        {/* Канала нет (терапевт с веб-аккаунтом, QA 2026-11 З6) — ссылки
            «Написать терапевту» тоже нет: tg:// на веб-номер вёл в никуда. */}
        {contact.url && (
          <a
            href={contact.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '14px 0',
              margin: '-8px 0 -14px',
              fontSize: 12,
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            {linkLabel}
          </a>
        )}
      </div>
    </div>
  );
}
