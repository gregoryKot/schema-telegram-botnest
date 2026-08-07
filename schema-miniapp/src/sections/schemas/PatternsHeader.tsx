// Шапка экрана «Паттерны»: заголовок + «Библиотека» в одном ряду, «Настроить»
// отдельной строкой ниже справа — на узком экране тесно ставить обе кнопки в
// ряд с заголовком (тот же приём, что ToolsList использует для
// «Инструменты»). Вынесено из SchemasSection.tsx — файл-храповик у потолка
// (правило №10 CLAUDE.md).
import { CustomizeButton } from '../../components/plusMenu/CustomizeButton';

interface Props {
  onOpenSchema: () => void;
  onCustomize: () => void;
}

export function PatternsHeader({ onOpenSchema, onCustomize }: Props) {
  return (
    <>
      <div
        style={{
          padding: '24px 20px 0',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
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
            marginTop: 4,
          }}
          title="Библиотека схема-терапии"
          aria-label="Библиотека схема-терапии"
        >
          Библиотека
        </button>
      </div>

      <div
        style={{
          padding: '6px 20px 0',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <CustomizeButton
          label="Настроить"
          ariaLabel="Настроить экран паттернов"
          onClick={onCustomize}
        />
      </div>
    </>
  );
}
