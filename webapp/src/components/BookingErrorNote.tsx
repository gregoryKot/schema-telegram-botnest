// Текст исхода неудачной отправки формы записи — см. bookingFailure.ts.
const noteSt: React.CSSProperties = { color: 'var(--accent-red)', fontSize: 13, margin: 0, lineHeight: 1.6 };

export function BookingErrorNote({ kind }: { kind: 'taken' | 'error' }) {
  if (kind === 'taken') {
    return <p style={noteSt}>Это время уже недоступно — возможно, его только что заняли. Выберите другое.</p>;
  }
  return (
    <p style={noteSt}>
      Заявка не сохранилась: сбой на моей стороне, повторная отправка не поможет.
      Самый быстрый путь — написать в Telegram: <a href="https://t.me/kotlarewski" style={{ color: 'inherit' }}>@kotlarewski</a>, запишу вручную.
    </p>
  );
}
