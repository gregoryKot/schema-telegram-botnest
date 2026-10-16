import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { GlyphArrowLeft } from '../exercises/ExScreen';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { buildModeCheckin, type ModeCheckinItem } from './data';

const OVERLAY_STYLE = {
  position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)',
  display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', animation: 'fade-in 150ms ease',
} as const;

// Чек-ин «Режим прямо сейчас»: выбор ощущения → режим и что помогает. Оба шага —
// один лист с одной записью истории (один хук на весь поток): системная «Назад»
// и Escape закрывают чек-ин, справочник схем под ним остаётся. «Назад» на
// экране результата закрывает весь чек-ин, а не возвращает к выбору — как и было.
export function ModeCheckinOverlay({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [mode, setMode] = useState<ModeCheckinItem | null>(null);
  const items = buildModeCheckin(tr);

  return (
    <div style={OVERLAY_STYLE}>
      <div className="ex-topbar">
        <button className="ex-back" onClick={goBack}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div className="page">
        {mode ? (
          <div className="page-inner" style={{ paddingTop: 48, maxWidth: 520 }}>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><IdentityDot color={mode.color} size={40} /></div>
            <div className="eyebrow" style={{ color: 'var(--accent)', textAlign: 'center', marginBottom: 8 }}>Режим</div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', textAlign: 'center', marginBottom: 32 }}>
              {mode.mode}
            </h1>
            <div className="aside-card" style={{ borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)', marginBottom: 32 }}>
              <div className="aside-card-eyebrow u-accent">Что помогает</div>
              <p className="body" style={{ margin: 0 }}>{mode.tip}</p>
            </div>
            <div className="ex-foot" style={{ padding: 0 }}>
              <span className="spacer" />
              <button onClick={goBack} className="ex-btn ex-btn-primary">Понятно</button>
            </div>
          </div>
        ) : (
          <div className="page-inner" style={{ paddingTop: 48 }}>
            <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>Режим прямо сейчас</div>
            <h1 className="hub-title u-mb8">{tr('Как ты', 'Как вы')}<br /><span className="it">сейчас?</span></h1>
            <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 32 }}>{tr('Выбери самое близкое ощущение', 'Выберите самое близкое ощущение')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-10)' }}>
              {items.map((item) => (
                <div
                  key={item.label}
                  onClick={() => setMode(item)}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMode(item); } }}
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
        )}
      </div>
    </div>
  );
}
