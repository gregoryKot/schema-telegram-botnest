import { useState } from 'react';
import { getModeById } from '../../schemaTherapyData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { MODE_TEST_COMPLETED_EVENT } from '../../../../shared/src/share/analytics';
import type { FeelGate } from '../../../../shared/src/mode/modeFeelGates';
import { MODE_PICKER_GROUPS } from '../../../../shared/src/mode/modeFeelGates';

/**
 * Ворота выбора режима «по базовым чувствам» (shared/mode/modeFeelGates) —
 * восемь чувств (страшно / грустно / злюсь / стыдно / нет сил / пусто /
 * на подъёме / хорошо), каждая раскрывается вопросом-уточнением и списком
 * знакомых фраз. Переиспользует данные теста (правило №11: один источник
 * формулировок на оба пути выбора).
 */
export function ModeFeelingBrowse({
  onPick,
}: {
  onPick: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const group: FeelGate | null = openId
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
          <div className="mode-test-group-question">{group.question}</div>
          <div className="mode-test-group-hint">{group.hint}</div>
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
                <span className="mode-test-row-emoji"><IdentityDot color={mode?.groupColor} size={14} /></span>
                <span className="mode-test-row-text">
                  <span className="mode-test-row-title">{leaf.label}</span>
                  <span className="mode-test-row-desc">{leaf.desc}</span>
                  <span className="mode-test-row-modename">
                    → {mode?.name ?? leaf.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
