import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { getTherapistContact } from '../utils/therapistContact';

const DISCLAIMER_CONTENT = [
  'Дневник помогает видеть паттерны и чуть лучше понимать себя.',
  'Советы внутри — это приглашение к размышлению, не инструкция.',
  'Если что-то важное требует внимания — терапия это место, где можно разобраться по-настоящему. Безопасно, глубоко, рядом живой человек.',
];

// Пояснение "О советах" под шитами потребности — общее для NeedHistorySheet
// и NeedTodaySheet (правило №11 CLAUDE.md, jscpd-свип).
export function NeedDisclaimerSheet({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 8 }}>
        <SectionLabel purple mb={16}>
          О советах
        </SectionLabel>
        {DISCLAIMER_CONTENT.map((p, i) => (
          <p
            key={i}
            style={{
              fontSize: 15,
              color: 'rgba(var(--fg-rgb),0.8)',
              lineHeight: 1.7,
              marginBottom: 14,
            }}
          >
            {p}
          </p>
        ))}
        <a
          href={getTherapistContact().url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            fontSize: 14,
            color: 'var(--accent)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          →{' '}
          {getTherapistContact().name === 'автору'
            ? 'Поговорить с психологом'
            : `Написать ${getTherapistContact().name}`}
        </a>
      </div>
    </BottomSheet>
  );
}
