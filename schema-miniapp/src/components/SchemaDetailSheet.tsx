import { useCallback, useState } from 'react';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { SCHEMA_BELIEFS } from '../schemaBeliefs';
import { MY_SCHEMA_IDS_KEY } from '../utils/storageKeys';
import { api } from '../api';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { drawSchemaCard } from '../../../shared/src/share/cards/schemaCard';
import { schemaShareText } from '../../../shared/src/share/shareTexts';
import { botShortUrl } from '../utils/botConfig';

function readSchemaIds(): string[] {
  try {
    return JSON.parse(
      localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '[]',
    ) as string[];
  } catch {
    return [];
  }
}

interface Props {
  schemaId: string;
  onClose: () => void;
  onOpenDiary: () => void;
}

export function SchemaDetailSheet({ schemaId, onClose, onOpenDiary }: Props) {
  const domainEntry = SCHEMA_DOMAINS.find((d) =>
    d.schemas.some((s) => s.id === schemaId),
  );
  const schema = domainEntry?.schemas.find((s) => s.id === schemaId);
  const [myIds, setMyIds] = useState<string[]>(readSchemaIds);
  const [showShare, setShowShare] = useState(false);
  const isAdded = myIds.includes(schemaId);

  const drawShareCard = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!schema || !domainEntry) return;
      drawSchemaCard(canvas, {
        domain: domainEntry.domain,
        domainColor: domainEntry.color,
        name: schema.name,
        desc: schema.libraryDesc ?? schema.desc,
        belief: SCHEMA_BELIEFS[schemaId]?.[0],
      });
    },
    [schema, domainEntry, schemaId],
  );

  if (!schema || !domainEntry) return null;

  const beliefs = SCHEMA_BELIEFS[schemaId] ?? [];
  const domainColor = domainEntry.color;

  function toggleSchema() {
    const next = isAdded
      ? myIds.filter((id) => id !== schemaId)
      : [...myIds, schemaId];
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(next));
    setMyIds(next);
    api.updateSettings({ mySchemaIds: next }).catch(() => {});
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--sheet-bg)',
          borderRadius: '24px 24px 0 0',
          padding: '8px 20px 40px',
          maxHeight: '80%',
          overflowY: 'auto',
          animation: 'sheet-up 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--border-color)',
            margin: '8px auto 20px',
          }}
        />

        {/* Domain + Schema name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: domainColor,
              flexShrink: 0,
              marginTop: 7,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: domainColor,
                marginBottom: 5,
              }}
            >
              {domainEntry.domain}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.3px',
              }}
            >
              {schema.name}
            </div>
          </div>
        </div>

        {/* Description */}
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 14,
          }}
        >
          <div
            style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.65 }}
          >
            {schema.libraryDesc ?? schema.desc}
          </div>
        </div>

        {/* Beliefs */}
        {beliefs.length > 0 && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                marginBottom: 8,
              }}
            >
              Типичные убеждения
            </div>
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-color)',
                borderRadius: 16,
                padding: '4px 16px',
                marginBottom: 16,
              }}
            >
              {beliefs.map((b, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '10px 0',
                    borderTop:
                      i > 0 ? '1px solid var(--border-color)' : undefined,
                  }}
                >
                  <span
                    style={{
                      color: domainColor,
                      flexShrink: 0,
                      fontSize: 18,
                      lineHeight: 1,
                    }}
                  >
                    ·
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--text-sub)',
                      lineHeight: 1.5,
                      fontStyle: 'italic',
                    }}
                  >
                    «{b}»
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={toggleSchema}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              background: isAdded
                ? 'var(--surface-2)'
                : 'color-mix(in srgb, var(--accent) 12%, transparent)',
              outline: `1px solid ${isAdded ? 'var(--border-color)' : 'color-mix(in srgb, var(--accent) 30%, transparent)'}`,
              color: isAdded ? 'var(--text-faint)' : 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isAdded ? '✓ В моих схемах' : '+ В мои схемы'}
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenDiary();
            }}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              background: 'linear-gradient(135deg, var(--accent), #60a5fa)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Познакомиться →
          </button>
        </div>

        {/* Поделиться карточкой схемы — заметная, но спокойная кнопка */}
        <button
          onClick={() => setShowShare(true)}
          style={{
            marginTop: 10,
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 44,
            padding: '0 16px',
            borderRadius: 14,
            border:
              '1px solid color-mix(in srgb, var(--accent) 24%, transparent)',
            background: 'color-mix(in srgb, var(--accent) 9%, transparent)',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 15V4m0 0L8 8m4-4 4 4M6 13v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Поделиться карточкой
        </button>
      </div>

      {showShare && (
        <div onClick={(e) => e.stopPropagation()}>
          <ShareCardSheet
            title="Карточка схемы"
            draw={drawShareCard}
            shareText={schemaShareText(schema.name, botShortUrl)}
            filename="schema.png"
            eventKind="schema"
            onClose={() => setShowShare(false)}
            zIndex={200}
          />
        </div>
      )}
    </div>
  );
}
