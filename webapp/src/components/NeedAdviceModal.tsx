import { getTherapistContact } from '../utils/therapistContact';
import { BottomSheetShell } from './BottomSheetShell';
import { ExternalLink } from '../host/ExternalLink';

// Оверлей «О советах» под шитами потребности — общий для NeedHistorySheet и
// NeedTodaySheet (правило №11: один и тот же блок жил дословно в обоих).
const DISCLAIMER_CONTENT = [
  'Дневник помогает видеть паттерны и чуть лучше понимать себя.',
  'Советы внутри — это приглашение к размышлению, не инструкция.',
  'Если что-то важное требует внимания — терапия это место, где можно разобраться по-настоящему, рядом с живым человеком.',
];

export function NeedAdviceModal({ onClose }: { onClose: () => void }) {
  const contact = getTherapistContact();
  return (
    <BottomSheetShell goBack={onClose} zIndex={300}>
        <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 16 }}>О советах</div>
        {DISCLAIMER_CONTENT.map((p, i) => (
          <p key={i} style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 14 }}>{p}</p>
        ))}
        {/* Терапевту не предлагаем ссылку на самого себя. */}
        {!contact.isTherapist && (
          <ExternalLink href={contact.url} style={{ display: 'inline-block', fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            → Записаться на консультацию</ExternalLink>
        )}
        <button
          onClick={onClose}
          className="ex-btn ex-btn-ghost"
          style={{ display: 'block', margin: '18px auto 0' }}
        >
          Понятно
        </button>
    </BottomSheetShell>
  );
}
