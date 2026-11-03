import '../../styles/therapist-clients.css';

// Ближайшая встреча одной формой в списке клиентов и в шапке карточки (#906):
// капитель «Встреча» + дата цветом --accent, без заливного бейджа. Подпись
// считает вызывающий: список — meetingLabel (явная дата или «по Вт»), шапка —
// clientNextSession (прошедшая дата переезжает на день встреч). Правила
// .tc-meeting* — therapist-clients.css, поэтому файл подключён отсюда.
export function NextSessionLine({ label, className }: { label: string | null; className?: string }) {
  return (
    <div className={className ? `tc-meeting ${className}` : 'tc-meeting'}>
      <span className="ds-label">Встреча</span>
      <span className={label ? 'tc-meeting-val' : 'tc-meeting-val tc-meeting-val--none'}>{label ?? 'не назначена'}</span>
    </div>
  );
}
