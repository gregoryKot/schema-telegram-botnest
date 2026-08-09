// Шапка экрана «Паттерны»: заголовок + шестерёнка настройки + «Библиотека» —
// одним рядом, выровненным по центру (было: пилюля «Настроить» отдельной
// строкой ниже справа — на глаз читалась как случайная). Шестерёнка — тот же
// GearButton, что и на «Сегодня» (правило «одна механика — один компонент»).
// Вынесено из SchemasSection.tsx — файл-храповик у потолка (правило №10).
import { GearButton } from '../../components/GearButton';

interface Props {
  onOpenSchema: () => void;
  onCustomize: () => void;
}

export function PatternsHeader({ onOpenSchema, onCustomize }: Props) {
  return (
    <div
      style={{
        padding: '24px 20px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div>
        <div className="d-display" style={{ fontSize: 27, lineHeight: 1.15 }}>
          Паттерны
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>
          Привычные реакции родом из детства
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <GearButton onClick={onCustomize} ariaLabel="Настроить экран" />
        <button
          onClick={onOpenSchema}
          className="d-caps"
          style={{
            minHeight: 48,
            padding: '0 14px',
            borderRadius: 14,
            border: 'none',
            background: 'var(--surface-2)',
            color: 'var(--accent)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          title="Библиотека схема-терапии"
          aria-label="Библиотека схема-терапии"
        >
          Библиотека
        </button>
      </div>
    </div>
  );
}
