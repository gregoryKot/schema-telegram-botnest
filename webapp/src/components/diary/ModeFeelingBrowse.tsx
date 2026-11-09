import { useState, type CSSProperties } from 'react';
import { getModeById } from '../../schemaTherapyData';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { SignChip } from '../paper/SignChip';
import { SignArt } from '../art/SignArt';
import { modeLookById } from './modeLookById';
import { MODE_TEST_COMPLETED_EVENT } from '../../../../shared/src/share/analytics';
import { MODE_PICKER_GROUPS, type FeelGate } from '../../../../shared/src/mode/modeFeelGates';

/**
 * Ворота выбора режима «по базовым чувствам» (shared/mode/modeFeelGates) —
 * восемь чувств, каждая раскрывается вопросом-уточнением и списком знакомых
 * фраз. Переиспользует данные теста (правило №11). Ворота — SignChip на небе
 * режимов; строка-фраза — бумага группы режима со знаком группы (modeLook), а не
 * цветная точка: клиент видит те же знаки, что терапевт (APP_2026-11.md, принцип 10).
 */
export function ModeFeelingBrowse({ onPick }: { onPick: (id: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const group: FeelGate | null = openId ? (MODE_PICKER_GROUPS.find((g) => g.id === openId) ?? null) : null;

  return (
    <div className="sd-feel" style={hueStyle(DIARY_HUE.mode)}>
      <div className="sd-chips">
        {MODE_PICKER_GROUPS.map((g) => (
          <SignChip key={g.id} label={g.title} on={openId === g.id}
            onToggle={() => { haptic.tap(); setOpenId((v) => (v === g.id ? null : g.id)); }} />
        ))}
      </div>

      {group && (
        <div className="sd-feel-list">
          <div className="sd-feel-q">{group.question}</div>
          <div className="sd-feel-hint">{group.hint}</div>
          {group.leaves.map((leaf) => {
            const mode = getModeById(leaf.modeId);
            const look = modeLookById(leaf.modeId);
            return (
              <button key={leaf.modeId} type="button" className="pp-paper sd-feel-row" style={{ '--h': look.hue } as CSSProperties}
                onClick={() => {
                  haptic.select();
                  // Событие переехало из удалённого окна-теста (ModeTestScreen) — чипы теперь единственный вход.
                  api.trackEvent(MODE_TEST_COMPLETED_EVENT, { modeId: leaf.modeId });
                  onPick(leaf.modeId);
                }}
              >
                <span className="sd-feel-sign" aria-hidden="true"><SignArt sign={look.sign} size="row" /></span>
                <span className="sd-feel-text">
                  <span className="sd-feel-title">{leaf.label}</span>
                  <span className="sd-feel-desc">{leaf.desc}</span>
                  <span className="sd-feel-mode">→ {mode?.name ?? leaf.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
