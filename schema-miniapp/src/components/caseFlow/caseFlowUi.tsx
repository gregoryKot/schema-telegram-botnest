import { haptic } from '../../haptic';

/**
 * Примитивы, общие для всех экранов потока «Разбор случая»: шапка
 * (назад + «Дописать потом», без заголовка — в отличие от diaryFlowUi.
 * SheetHeader, здесь по ТЗ нет общего названия листа) и третичная
 * ссылка-строка («Сегодня ровный день →», «Тяжело прямо сейчас →» и т.д.).
 * PrimaryAction/StepProgress переиспользуются из diaryFlowUi напрямую —
 * копии здесь не заводим (правило «одна механика — один компонент»).
 */

export function CaseHeader({
  onBack,
  onLater,
}: {
  onBack?: () => void;
  onLater: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 14,
      }}
    >
      <span>
        {onBack && (
          <button
            onClick={() => {
              haptic.tap();
              onBack();
            }}
            aria-label="Назад"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 24,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '10px 10px 10px 0',
              minHeight: 44,
              minWidth: 44,
            }}
          >
            ‹
          </button>
        )}
      </span>
      <button
        onClick={onLater}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--muted)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '10px 2px',
          minHeight: 44,
        }}
      >
        Дописать потом
      </button>
    </div>
  );
}

/** Третичная строка-ссылка: «Сегодня ровный день →», «Пропустить →» и т.п.
 *  haptic.tap() централизован здесь — вызывающему коду достаточно onClick. */
export function TertiaryLink({
  label,
  onClick,
  muted,
}: {
  label: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      style={{
        display: 'block',
        background: 'none',
        border: 'none',
        color: muted ? 'var(--muted)' : 'var(--accent)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        padding: '12px 2px',
        minHeight: 44,
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}
