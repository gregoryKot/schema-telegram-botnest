import { useState } from 'react';
import { getModeById } from '../../schemaTherapyData';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { MODE_TEST_COMPLETED_EVENT } from '../../../../shared/src/share/analytics';
import type { FeelGate } from '../../../../shared/src/mode/modeFeelGates';
import { MODE_PICKER_GROUPS } from '../../../../shared/src/mode/modeFeelGates';

/**
 * Ворота выбора режима «по базовым чувствам» (shared/mode/modeFeelGates) —
 * восемь чувств (страшно / грустно / злюсь / стыдно / нет сил / пусто /
 * на подъёме / хорошо), для тех, кто уже примерно понимает состояние и не
 * хочет искать в таксономических группах MODE_GROUPS. Каждая семья
 * раскрывается вопросом-уточнением и списком знакомых фраз. Переиспользует
 * данные теста (правило №11: один источник формулировок, а не второй список).
 */
export function ModeFeelingBrowse({
  onChange,
}: {
  onChange: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const group: FeelGate | null = openId
    ? (MODE_PICKER_GROUPS.find((g) => g.id === openId) ?? null)
    : null;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {MODE_PICKER_GROUPS.map((g) => {
          const active = openId === g.id;
          return (
            <button
              key={g.id}
              onClick={() => {
                haptic.tap();
                setOpenId(active ? null : g.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: active
                  ? 'rgba(96,165,250,0.16)'
                  : 'rgba(var(--fg-rgb),0.06)',
                border: active
                  ? '1px solid rgba(96,165,250,0.4)'
                  : '1px solid transparent',
                borderRadius: 16,
                padding: '6px 11px',
                color: active
                  ? 'var(--accent-blue)'
                  : 'rgba(var(--fg-rgb),0.65)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span>{g.emoji}</span>
              {g.title}
            </button>
          );
        })}
      </div>

      {group && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.3,
              marginBottom: 4,
            }}
          >
            {group.question}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-faint)',
              lineHeight: 1.4,
              marginBottom: 8,
            }}
          >
            {group.hint}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.leaves.map((leaf) => {
              const mode = getModeById(leaf.modeId);
              return (
                <button
                  key={leaf.modeId}
                  onClick={() => {
                    haptic.select();
                    // Событие переехало из удалённого окна-теста (ModeTestSheet) —
                    // чипы теперь единственный вход выбора режима.
                    api.trackEvent(MODE_TEST_COMPLETED_EVENT, {
                      modeId: leaf.modeId,
                    });
                    onChange(leaf.modeId);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'rgba(var(--fg-rgb),0.05)',
                    border: '1px solid rgba(var(--fg-rgb),0.06)',
                    borderRadius: 14,
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>
                    {leaf.emoji}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {leaf.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--text-sub)',
                        marginTop: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {leaf.desc}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-faint)',
                        marginTop: 3,
                      }}
                    >
                      → {mode?.name ?? leaf.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
