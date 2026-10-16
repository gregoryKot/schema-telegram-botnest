import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { MODE_GROUP_HUE, hueStyle } from '../../lib/tone';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { buildModes, type ModeCheckinItem } from './data';
import { ModeCheckin } from './ModeCheckin';

/** Группы справочника → ключ MODE_GROUP_HUE (копинги в палитре все одного тона). */
const GROUP_HUE_KEY: Record<string, string> = {
  'Детские режимы': 'child',
  'Дисфункциональные копинги': 'coping_surrender',
  'Критикующие режимы': 'critic',
  'Здоровые режимы': 'healthy',
};

// Вкладка «режимы» справочника схем: карточки режимов + чек-ин.
// Вынесено из SchemaInfoSheet.tsx (правило №10).
export function ModesTab() {
  const tr = useTr();
  const MODES = buildModes(tr);
  const [checkinMode, setCheckinMode] = useState<ModeCheckinItem | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const close = () => { setCheckinMode(null); setShowCheckin(false); };

  return (
    <div className="ss-pane">
      <div
        onClick={() => setShowCheckin(true)}
        role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowCheckin(true); } }}
        className="ds-card ds-card--hover ss-cta"
      >
        <div className="ss-cta-text">
          <div className="ds-eyebrow">Режим прямо сейчас</div>
          <div className="ss-need-title">{tr('Как ты себя чувствуешь? →', 'Как вы себя чувствуете? →')}</div>
        </div>
      </div>

      <p className="ss-body">
        Режим – это актуальное состояние психики прямо сейчас. Цель – расширить доступ к Здоровому Взрослому.
      </p>

      {MODES.map((g) => (
        <div key={g.group} className="ss-pane" style={hueStyle(MODE_GROUP_HUE[GROUP_HUE_KEY[g.group]])}>
          <span className="ds-chip tone-tint" style={{ alignSelf: 'flex-start' }}>
            <span className="ds-dot tone-fill" />
            {g.group}
          </span>
          {g.items.map((m) => (
            <div key={m.name} className="ds-card ss-mode">
              <div className="ss-need-head">
                <IdentityDot color={g.color} size={16} />
                <div>
                  <div className="ss-mode-name">{m.name}</div>
                  <div className="ss-mode-feel">Чувствуется как: {m.feel}</div>
                </div>
              </div>
              <p className="ss-body ss-body--sm">{m.desc}</p>
            </div>
          ))}
        </div>
      ))}

      {showCheckin && (
        <ModeCheckin mode={checkinMode} onPick={setCheckinMode} onBack={() => setShowCheckin(false)} onDone={close} />
      )}
    </div>
  );
}
