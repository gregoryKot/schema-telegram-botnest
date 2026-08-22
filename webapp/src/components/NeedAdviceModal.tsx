import { pressable } from '../utils/a11y';
import { getTherapistContact } from '../utils/therapistContact';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';

// Оверлей «О советах» под шитами потребности — общий для NeedHistorySheet и
// NeedTodaySheet (правило №11: один и тот же блок жил дословно в обоих).
const DISCLAIMER_CONTENT = [
  'Дневник помогает видеть паттерны и чуть лучше понимать себя.',
  'Советы внутри — это приглашение к размышлению, не инструкция.',
  'Если что-то важное требует внимания — терапия это место, где можно разобраться по-настоящему, рядом с живым человеком.',
];

export function NeedAdviceModal({ onClose }: { onClose: () => void }) {
  const contact = getTherapistContact();
  const dialogA11y = useDialogA11y();
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}
      aria-label="Закрыть"
      {...pressable(onClose)}
    >
      {/* onClick/onKeyDown здесь — не интерактив, а stopPropagation: не дать
          клику/Enter-Space внутри диалога всплыть до pressable(onClose) на
          бэкдропе. role="dialog" (К4, useDialogA11y) не входит в список
          «интерактивных» ролей jsx-a11y, поэтому правило ложно срабатывает
          на паре onClick+role — onKeyDown уже есть, click-events-have-key-events
          доволен. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        {...dialogA11y}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '24px 24px 48px', width: '100%', maxWidth: 560, margin: '0 auto' }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 'var(--r-2)', background: 'var(--surface-3)', margin: '0 auto 20px' }} />
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
