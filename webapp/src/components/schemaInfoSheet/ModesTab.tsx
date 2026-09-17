import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { GlyphArrowLeft } from '../exercises/ExScreen';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import {
  buildModes,
  buildModeCheckin,
  type ModeCheckinItem,
} from './data';

// Вкладка «режимы» справочника схем: карточки режимов + чек-ин.
// Вынесено из SchemaInfoSheet.tsx (правило №10).
export function ModesTab() {
  const tr = useTr();
  const MODES = buildModes(tr);
  const MODE_CHECKIN = buildModeCheckin(tr);
  const [checkinMode, setCheckinMode] = useState<ModeCheckinItem | null>(null);
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
        Режим – это актуальное состояние психики прямо сейчас. Цель – расширить доступ к Здоровому взрослому.
      </p>

      {MODES.map((g) => (
        <div key={g.group} style={{ marginBottom: 24 }}>
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

      {/* Check-in selector */}
      {showCheckin && !checkinMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', animation: 'fade-in 150ms ease' }}>
          <div className="ex-topbar">
            <button className="ex-back" onClick={() => setShowCheckin(false)}>
              <GlyphArrowLeft /> Назад
            </button>
          </div>
          <div className="page">
            <div className="page-inner" style={{ paddingTop: 48 }}>
              <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>Режим прямо сейчас</div>
              <h1 className="hub-title" style={{ marginBottom: 8 }}>{tr('Как ты', 'Как вы')}<br /><span className="it">сейчас?</span></h1>
              <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 36 }}>{tr('Выбери самое близкое ощущение', 'Выберите самое близкое ощущение')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-10)' }}>
                {MODE_CHECKIN.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => setCheckinMode(item)}
                    role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCheckinMode(item); } }}
                    className="mode-card"
                    style={{ '--mode-color': 'var(--accent)' } as React.CSSProperties}
                  >
                    <span className="mode-card-stripe" />
                    <div style={{ textAlign: 'center', width: '100%', padding: '4px 0' }}>
                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IdentityDot color={item.color} size={22} /></div>
                      <div className="mode-card-name" style={{ fontSize: 13, textAlign: 'center' }}>{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result overlay */}
      {checkinMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', animation: 'fade-in 150ms ease' }}>
          <div className="ex-topbar">
            <button className="ex-back" onClick={() => { setCheckinMode(null); setShowCheckin(false); }}>
              <GlyphArrowLeft /> Назад
            </button>
          </div>
          <div className="page">
            <div className="page-inner" style={{ paddingTop: 56, maxWidth: 520 }}>
              <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><IdentityDot color={checkinMode.color} size={40} /></div>
              <div className="eyebrow" style={{ color: 'var(--accent)', textAlign: 'center', marginBottom: 8 }}>Режим</div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', textAlign: 'center', marginBottom: 32 }}>
                {checkinMode.mode}
              </h1>
              <div className="aside-card" style={{ borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)', marginBottom: 32 }}>
                <div className="aside-card-eyebrow" style={{ color: 'var(--accent)' }}>Что помогает</div>
                <p className="body" style={{ margin: 0 }}>{checkinMode.tip}</p>
              </div>
              <div className="ex-foot" style={{ padding: 0 }}>
                <span className="spacer" />
                <button
                  onClick={() => { setCheckinMode(null); setShowCheckin(false); }}
                  className="ex-btn ex-btn-primary"
                >
                  Понятно
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
