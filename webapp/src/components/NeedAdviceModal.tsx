import { pressable } from '../utils/a11y';
import { getTherapistContact } from '../utils/therapistContact';

// Оверлей «О советах» под шитами потребности — общий для NeedHistorySheet и
// NeedTodaySheet (правило №11: один и тот же блок жил дословно в обоих).
const DISCLAIMER_CONTENT = [
  'Дневник помогает видеть паттерны и чуть лучше понимать себя.',
  'Советы внутри — это приглашение к размышлению, не инструкция.',
  'Если что-то важное требует внимания — терапия это место, где можно разобраться по-настоящему. Безопасно, глубоко, рядом живой человек.',
];

export function NeedAdviceModal({ onClose }: { onClose: () => void }) {
  const contact = getTherapistContact();
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}
      aria-label="Закрыть"
      {...pressable(onClose)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); } }}
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '24px 24px 48px', width: '100%', maxWidth: 560, margin: '0 auto' }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '0 auto 20px' }} />
        <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 16 }}>О советах</div>
        {DISCLAIMER_CONTENT.map((p, i) => (
          <p key={i} style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 14 }}>{p}</p>
        ))}
        {/* Терапевту не предлагаем ссылку на самого себя. */}
        {!contact.isTherapist && (
          <a href={contact.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            → Поговорить с психологом
          </a>
        )}
      </div>
    </div>
  );
}
