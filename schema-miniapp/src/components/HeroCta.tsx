// Крупная акцентная CTA-карточка (дизайн-макет): uppercase-лейбл, чип
// с оценкой времени, заголовок, подпись, белая кнопка. Одна на все экраны
// («Сегодня», «Паттерны», «Режимы») — правило «одна механика — один компонент».
//
// nested-interactive (axe, 2026-08): карточка была div[role="button"] вокруг
// настоящей <button> — два интерактивных элемента вложенно. Теперь ровно
// один таб-стоп: <button> реальная и фокусируемая, div — простой
// onClick-контейнер без role/tabIndex. Клик мимо кнопки по-прежнему работает
// (bubbling), а Enter/Space на кнопке тоже доходит до onClick обёртки.
interface Props {
  label: string;
  chip: string;
  title: string;
  sub: string;
  buttonLabel: string;
  onClick: () => void;
}

export function HeroCta({
  label,
  chip,
  title,
  sub,
  buttonLabel,
  onClick,
}: Props) {
  return (
    // Намеренно без role/tabIndex: клавиатурный доступ даёт только <button>
    // ниже, div — лишь расширение зоны клика мышью/тапом до всей карточки.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 24,
        padding: 20,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        background: 'var(--accent)',
        color: 'var(--on-accent)',
        boxShadow:
          '0 14px 34px color-mix(in srgb, var(--accent) 35%, transparent)',
        animation: 'slide-up 0.3s ease both',
      }}
    >
      {/* Декоративный «дышащий» круг (как на экране «Помощь») */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -34,
          top: -34,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.10)',
          animation: 'hero-breathe 6s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              // Без opacity: приглушение до 0.85 давало 4.14:1 на акцентном
              // фоне при норме 4.5:1 для мелкого текста (axe, WCAG 1.4.3).
              // Полный белый — 5.13:1; надпись и так вторична по размеру.
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              // color-contrast (axe): было 2.91:1 (белое на белом оверлее).
              // Затемняющая подложка держит ≥5:1 в обеих темах — ТОЛЬКО для
              // белого текста (проверено численно: 7.93:1 светлая тема,
              // 5.15:1 тёмная). Явный '#fff', не унаследованный
              // var(--on-accent): тот в тёмной теме — тёмные чернила (лучше
              // на плоском --accent), а на ЭТОЙ, дополнительно затемнённой
              // подложке чернила дают только 3.61:1 (дизайн-аудит 2026-08,
              // В11-волна).
              color: '#fff',
              background: 'rgba(0,0,0,0.24)',
              padding: '4px 10px',
              borderRadius: 99,
              flexShrink: 0,
            }}
          >
            {chip}
          </div>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginTop: 10,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <div
          style={{ fontSize: 13, opacity: 0.9, marginTop: 6, lineHeight: 1.45 }}
        >
          {sub}
        </div>
        <button
          // Видимый текст — короткий глагол («Начать»), одинаковый на разных
          // карточках и неотличимый вне контекста. aria-label добавляет
          // заголовок (WCAG 2.5.3 Label in Name: buttonLabel остаётся внутри).
          aria-label={`${title}. ${buttonLabel}`}
          style={{
            marginTop: 15,
            width: '100%',
            background: '#fff',
            // Подложка белая в ОБЕИХ темах, поэтому и текст берёт акцент,
            // не переключающийся по теме: --accent в тёмной осветляется до
            // #c97d5a и даёт на белом 3.19:1. Тёмный вариант — 5.33:1.
            color: 'var(--accent-on-light)',
            fontSize: 15,
            fontWeight: 800,
            padding: 13,
            borderRadius: 'var(--r-14)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {buttonLabel}
          <span aria-hidden style={{ fontSize: 17 }}>
            →
          </span>
        </button>
      </div>
    </div>
  );
}
