import { useState } from 'react';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { ModeTestSheet } from './ModeTestSheet';
import { ModeFeelingBrowse } from './ModeFeelingBrowse';
import { ModeGroupList } from './ModeGroupList';

/**
 * Шаг 1 дневника режимов: выбор режима.
 * Тест-первым («не знаю какой → определим по чувству») + навигация «по
 * ощущению» (те же 8 семей теста, сразу списком — ModeFeelingBrowse) +
 * свёрнутый полный список групп для тех, кто знает точное название
 * (ModeGroupList). Заменяет свалку из 35 режимов и таксономию, где первой
 * попадается только «Детские режимы» (правило онбординга: одно очевидное
 * действие на экран). Механика теста — ModeTestSheet.
 */
export function ModeSelectStep({
  modeId,
  onChange,
}: {
  modeId: string;
  onChange: (id: string) => void;
}) {
  const tr = useTr();
  const [showTest, setShowTest] = useState(false);
  const [showList, setShowList] = useState(false);

  const selectedMode = modeId
    ? MODE_GROUPS.flatMap((g) =>
        g.items.map((m) => ({ ...m, color: g.color })),
      ).find((m) => m.id === modeId)
    : null;

  if (selectedMode) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: `${selectedMode.color}14`,
          border: `1px solid ${selectedMode.color}55`,
          borderRadius: 16,
          padding: '12px 14px',
        }}
      >
        <span style={{ fontSize: 26, flexShrink: 0 }}>
          {selectedMode.emoji}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {selectedMode.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
            {selectedMode.short}
          </div>
        </div>
        <button
          onClick={() => {
            haptic.tap();
            onChange('');
            setShowList(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-blue)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Сменить
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          haptic.tap();
          setShowTest(true);
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background:
            'linear-gradient(135deg, rgba(96,165,250,0.16), rgba(96,165,250,0.08))',
          border: '1px solid rgba(96,165,250,0.35)',
          borderRadius: 16,
          padding: '14px 16px',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 24 }}>🧭</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            Не знаю, какой режим
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
            Определим по чувству — пара тапов
          </div>
        </div>
        <span style={{ color: 'var(--accent-blue)', fontSize: 18 }}>→</span>
      </button>

      <div style={{ margin: '16px 0 8px' }}>
        <div
          style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}
        >
          {tr(
            'Или найди по ощущению — те же состояния, что и в тесте:',
            'Или найдите по ощущению — те же состояния, что и в тесте:',
          )}
        </div>
        <ModeFeelingBrowse onChange={onChange} />
      </div>

      <button
        onClick={() => {
          haptic.tap();
          setShowList((v) => !v);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-sub)',
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '10px 2px 4px',
        }}
      >
        Все режимы по группам {showList ? '▲' : '▼'}
      </button>

      {showList && (
        <ModeGroupList
          onChange={(id) => {
            onChange(id);
            setShowList(false);
          }}
        />
      )}

      {showTest && (
        <ModeTestSheet
          onClose={() => setShowTest(false)}
          onResolve={(id) => {
            onChange(id);
            setShowTest(false);
            setShowList(false);
          }}
        />
      )}
    </>
  );
}
