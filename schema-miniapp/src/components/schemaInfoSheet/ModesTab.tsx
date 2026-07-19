import { useCallback, useState } from 'react';
import { pressable } from '../../utils/a11y';
import { SectionLabel } from '../SectionLabel';
import { useTr } from '../../utils/addressForm';
import { buildModes } from './modesData';
import { buildModeCheckin, type ModeCheckinItem } from './modeCheckinData';
import { SharePill } from '../../share/SharePill';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { drawSchemaCard } from '../../../../shared/src/share/cards/schemaCard';
import { modeShareText } from '../../../../shared/src/share/shareTexts';
import { botShortUrl } from '../../utils/botConfig';

interface ShareMode {
  group: string;
  color: string;
  name: string;
  feel: string;
  desc: string;
}

export function ModesTab() {
  const tr = useTr();
  const MODES = buildModes(tr);
  const MODE_CHECKIN = buildModeCheckin(tr);
  const [checkinMode, setCheckinMode] = useState<ModeCheckinItem | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [shareMode, setShareMode] = useState<ShareMode | null>(null);

  const drawModeCard = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!shareMode) return;
      drawSchemaCard(canvas, {
        domain: shareMode.group,
        domainColor: shareMode.color,
        name: shareMode.name,
        desc: shareMode.desc,
        belief: `Чувствуется как: ${shareMode.feel}`,
        footerLabel: 'Режимы',
      });
    },
    [shareMode],
  );

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
                <div style={{ flex: 1, minWidth: 0 }}>
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
                <SharePill
                  compact
                  onClick={() =>
                    setShareMode({
                      group: g.group,
                      color: g.color,
                      name: m.name,
                      feel: m.feel,
                      desc: m.desc,
                    })
                  }
                />
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fade-in 150ms ease',
          }}
          {...pressable(() => setShowCheckin(false))}
          aria-label="Закрыть"
        >
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--sheet-bg)',
              borderRadius: '24px 24px 0 0',
              padding: '20px 20px 48px',
              animation: 'sheet-up 300ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(var(--fg-rgb),0.12)',
                  margin: '0 auto 16px',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 4,
                textAlign: 'center',
              }}
            >
              {tr('Как ты сейчас?', 'Как вы сейчас?')}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              {tr(
                'Выбери самое близкое ощущение',
                'Выберите самое близкое ощущение',
              )}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
              }}
            >
              {MODE_CHECKIN.map((item) => (
                <div
                  key={item.label}
                  onClick={() => setCheckinMode(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setCheckinMode(item);
                    }
                  }}
                  style={{
                    background: 'rgba(var(--fg-rgb),0.05)',
                    borderRadius: 14,
                    padding: '12px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: '1px solid rgba(var(--fg-rgb),0.06)',
                  }}
                >
                  <div style={{ fontSize: 26, marginBottom: 6 }}>
                    {item.emoji}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-sub)',
                      lineHeight: 1.4,
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Result overlay */}
      {checkinMode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            animation: 'fade-in 150ms ease',
          }}
          {...pressable(() => {
            setCheckinMode(null);
            setShowCheckin(false);
          })}
          aria-label="Закрыть"
        >
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            style={{
              background:
                'linear-gradient(145deg, color-mix(in srgb, var(--accent) 18%, transparent), rgba(79,163,247,0.08))',
              border:
                '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              borderRadius: 24,
              padding: '32px 24px 24px',
              width: '100%',
              maxWidth: 320,
              textAlign: 'center',
              animation: 'sheet-up 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 12 }}>
              {checkinMode.emoji}
            </div>
            <SectionLabel purple mb={8}>
              Режим
            </SectionLabel>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
              }}
            >
              {checkinMode.mode}
            </div>
            <div
              style={{
                background: 'rgba(var(--fg-rgb),0.06)',
                borderRadius: 14,
                padding: '14px 16px',
                marginBottom: 24,
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--accent)',
                  marginBottom: 6,
                }}
              >
                Что помогает
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'rgba(var(--fg-rgb),0.8)',
                  lineHeight: 1.6,
                }}
              >
                {checkinMode.tip}
              </div>
            </div>
            <button
              onClick={() => {
                setCheckinMode(null);
                setShowCheckin(false);
              }}
              style={{
                width: '100%',
                padding: '14px 0',
                border: 'none',
                borderRadius: 14,
                background:
                  'color-mix(in srgb, var(--accent) 25%, transparent)',
                color: 'var(--accent)',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      {shareMode && (
        <ShareCardSheet
          title="Карточка режима"
          draw={drawModeCard}
          shareText={modeShareText(shareMode.name, botShortUrl)}
          filename="mode.png"
          eventKind="mode"
          onClose={() => setShareMode(null)}
          zIndex={300}
        />
      )}
    </div>
  );
}
