import { useState } from 'react';
import { getModeById } from '../../schemaTherapyData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { MODE_TEST_COMPLETED_EVENT } from '../../../../shared/src/share/analytics';
import { MODE_PICKER_GROUPS, type FeelGate } from '../../../../shared/src/mode/modeFeelGates';

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
    <div className="sd-feel" style={hueStyle(DIARY_HUE.mode)}>
      <div className="sd-chips">
        {MODE_PICKER_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={'ds-chip sd-chip' + (openId === g.id ? ' is-selected tone-tint' : '')}
            onClick={() => {
              haptic.tap();
              setOpenId((v) => (v === g.id ? null : g.id));
            }}
          >
            {g.title}
          </button>
        ))}
      </div>

      {group && (
        <div className="sd-feel-list">
          <div className="ds-h3 sd-feel-q">{group.question}</div>
          <div className="ds-sub">{group.hint}</div>
          {group.leaves.map((leaf) => {
            const mode = getModeById(leaf.modeId);
            return (
              <button
                key={leaf.modeId}
                type="button"
                className="ds-card ds-card--row ds-card--hover sd-feel-row"
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
                <span className="sd-feel-dot"><IdentityDot color={mode?.groupColor} size={14} /></span>
                <span className="sd-feel-text">
                  <span className="sd-feel-title">{leaf.label}</span>
                  <span className="ds-sub">{leaf.desc}</span>
                  <span className="sd-feel-mode tone-ink">
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
