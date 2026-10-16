import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { buildModes } from './data';
import { ModeCheckinOverlay } from './ModeCheckinOverlay';

// Вкладка «режимы» справочника схем: карточки режимов + чек-ин.
// Вынесено из SchemaInfoSheet.tsx (правило №10).
export function ModesTab() {
  const tr = useTr();
  const MODES = buildModes(tr);
  const [showCheckin, setShowCheckin] = useState(false);

  return (
    <div>
      <div
        onClick={() => setShowCheckin(true)}
        role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowCheckin(true); } }}
        style={{
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          borderRadius: 'var(--r-16)', padding: '16px 20px', marginBottom: 24, cursor: 'pointer',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 6 }}>Режим прямо сейчас</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)' }}>{tr('Как ты себя чувствуешь? →', 'Как вы себя чувствуете? →')}</div>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 24 }}>
        Режим – это актуальное состояние психики прямо сейчас. Цель – расширить доступ к Здоровому Взрослому.
      </p>

      {MODES.map((g) => (
        <div key={g.group} className="u-mb24">
          <div className="eyebrow" style={{ color: g.color, marginBottom: 12 }}>{g.group}</div>
          {g.items.map((m) => (
            <div key={m.name} style={{ borderBottom: '1px solid var(--line)', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', marginBottom: 8 }}>
                <IdentityDot color={g.color} size={16} />
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--text)' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>Чувствуется как: {m.feel}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 }}>{m.desc}</p>
            </div>
          ))}
        </div>
      ))}

      {showCheckin && <ModeCheckinOverlay onClose={() => setShowCheckin(false)} />}
    </div>
  );
}
