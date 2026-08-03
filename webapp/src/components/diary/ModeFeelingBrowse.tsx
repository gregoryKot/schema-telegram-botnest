import { useState } from 'react';
import { getModeById } from '../../schemaTherapyData';
import { haptic } from '../../haptic';
import { MODE_TEST_GROUPS } from '../../../../shared/src/mode/modeTest';

/**
 * Навигация по режиму «по ощущению» — те же 8 семей, что и в тесте «не знаю
 * режим» (shared/mode/modeTest), сразу списком, без вопросов. Переиспользует
 * данные теста (правило №11: один источник семей на оба пути выбора).
 */
export function ModeFeelingBrowse({
  onPick,
}: {
  onPick: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const group = openId
    ? (MODE_TEST_GROUPS.find((g) => g.id === openId) ?? null)
    : null;

  return (
    <div style={{ marginBottom: group ? 4 : 12 }}>
      <div className="chip-row" style={{ marginBottom: group ? 10 : 16 }}>
        {MODE_TEST_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={'chip-pill ' + (openId === g.id ? 'is-selected' : '')}
            onClick={() => {
              haptic.tap();
              setOpenId((v) => (v === g.id ? null : g.id));
            }}
          >
            {g.emoji} {g.title}
          </button>
        ))}
      </div>

      {group && (
        <div style={{ marginBottom: 8 }}>
          {group.leaves.map((leaf) => {
            const mode = getModeById(leaf.modeId);
            return (
              <button
                key={leaf.modeId}
                type="button"
                className="mode-test-row"
                onClick={() => {
                  haptic.select();
                  onPick(leaf.modeId);
                }}
              >
                <span className="mode-test-row-emoji">{leaf.emoji}</span>
                <span className="mode-test-row-text">
                  <span className="mode-test-row-title">
                    {mode?.name ?? leaf.label}
                  </span>
                  <span className="mode-test-row-hint">{leaf.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
