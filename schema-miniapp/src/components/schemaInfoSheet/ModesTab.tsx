import { useCallback, useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { buildModes } from './modesData';
import { ModeCheckinSheet } from './ModeCheckinSheet';
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
            'linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, transparent), color-mix(in srgb, var(--accent-blue) 10%, transparent))',
          border:
            '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          borderRadius: 'var(--r-16)',
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
        доступ к Здоровому Взрослому.
      </p>

      {MODES.map((g) => (
        <div key={g.group} className="u-mb20">
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
                borderRadius: 'var(--r-14)',
                padding: '12px 14px',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-8)',
                  marginBottom: 6,
                }}
              >
                <div className="u-fill">
                  <div className="u-h14">{m.name}</div>
                  <div className="u-sub11-mt1">Чувствуется как: {m.feel}</div>
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

      {showCheckin && (
        <ModeCheckinSheet onClose={() => setShowCheckin(false)} />
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
