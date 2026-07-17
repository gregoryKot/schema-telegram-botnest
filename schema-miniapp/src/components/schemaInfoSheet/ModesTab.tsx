import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { buildModes } from './modesData';
import { buildModeCheckin, type ModeCheckinItem } from './modeCheckinData';
import { ModeCheckinSelector } from './ModeCheckinSelector';
import { ModeCheckinResult } from './ModeCheckinResult';

export function ModesTab() {
  const tr = useTr();
  const MODES = buildModes(tr);
  const MODE_CHECKIN = buildModeCheckin(tr);
  const [checkinMode, setCheckinMode] = useState<ModeCheckinItem | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);

  return (
    <div>
      {/* Check-in widget */}
      <div
        onClick={() => setShowCheckin(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowCheckin(true);
          }
        }}
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, transparent), rgba(79,163,247,0.1))',
          border:
            '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: 20,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--accent)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}
        >
          Режим прямо сейчас
        </div>
        <div style={{ fontSize: 14, color: 'rgba(var(--fg-rgb),0.7)' }}>
          {tr('Как ты себя чувствуешь? →', 'Как вы себя чувствуете? →')}
        </div>
      </div>

      <p
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          lineHeight: 1.6,
          marginBottom: 20,
        }}
      >
        Режим — это актуальное состояние психики прямо сейчас. В отличие от схем
        (устойчивых паттернов), режимы меняются в течение дня. Цель — расширить
        доступ к Здоровому взрослому.
      </p>

      {MODES.map((g) => (
        <div key={g.group} style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: g.color,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 10,
            }}
          >
            {g.group}
          </div>
          {g.items.map((m) => (
            <div
              key={m.name}
              style={{
                background: 'rgba(var(--fg-rgb),0.04)',
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 20 }}>{m.emoji}</span>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {m.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-sub)',
                      marginTop: 1,
                    }}
                  >
                    Чувствуется как: {m.feel}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-sub)',
                  lineHeight: 1.6,
                }}
              >
                {m.desc}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Check-in selector */}
      {showCheckin && !checkinMode && (
        <ModeCheckinSelector
          items={MODE_CHECKIN}
          onClose={() => setShowCheckin(false)}
          onSelect={setCheckinMode}
        />
      )}

      {/* Result overlay */}
      {checkinMode && (
        <ModeCheckinResult
          item={checkinMode}
          onClose={() => {
            setCheckinMode(null);
            setShowCheckin(false);
          }}
        />
      )}
    </div>
  );
}
