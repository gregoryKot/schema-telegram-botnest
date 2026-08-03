import { useState } from 'react';
import { getModeById } from '../../schemaTherapyData';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { MODE_TEST_COMPLETED_EVENT } from '../../../../shared/src/share/analytics';
import { MODE_PICKER_GROUPS } from '../../../../shared/src/mode/modeBodyCues';

/**
 * Навигация по режиму «по ощущению» — те же 8 семей, что и в тесте «не знаю
 * режим» (shared/mode/modeTest), плюс вход «не знаю, что чувствую, или пусто»
 * последним (shared/mode/modeBodyCues), сразу списком, без вопросов.
 * Переиспользует данные теста (правило №11: один источник семей на оба пути
 * выбора).
 */
export function ModeFeelingBrowse({
  onPick,
}: {
  onPick: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const group = openId
    ? (MODE_PICKER_GROUPS.find((g) => g.id === openId) ?? null)
    : null;

  return (
    <div style={{ marginBottom: group ? 4 : 12 }}>
      <div className="chip-row" style={{ marginBottom: group ? 10 : 16 }}>
        {MODE_PICKER_GROUPS.map((g) => (
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
                  // Событие переехало из удалённого окна-теста (ModeTestScreen) —
                  // чипы теперь единственный вход выбора режима.
                  api.trackEvent(MODE_TEST_COMPLETED_EVENT, {
                    modeId: leaf.modeId,
                  });
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
