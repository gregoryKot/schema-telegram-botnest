// Лупа → общий поиск (палитра ⌘K) в шапке экрана: только там, где строки .topbar с «Перейти к…» нет
// (телефон, index.css). Одна кнопка на кабинет («Клиенты», .tc-find) и на «Сегодня» клиента (.search-find).
export function FindButton({ className, label, onClick }: { className: string; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`ds-btn ds-btn--icon find-btn ${className}`} aria-label={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M15.5 15.5 L20.5 20.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
