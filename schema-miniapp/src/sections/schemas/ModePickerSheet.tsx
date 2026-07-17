import { useState } from 'react';
import { MODE_GROUPS, ALL_MODES } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { BottomSheet } from '../../components/BottomSheet';
import { cm } from './utils';
import { POPULAR_MODE_IDS, MODE_DESC } from './constants';

export function ModePickerSheet({
  selected,
  onSave,
  onClose,
}: {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const [ids, setIds] = useState<string[]>(selected);
  const toggle = (id: string) =>
    setIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 4,
          }}
        >
          Мои режимы
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {tr(
            'Выбери режимы которые ты замечаешь у себя.',
            'Выберите режимы которые вы замечаете у себя.',
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-sub)',
              marginBottom: 8,
            }}
          >
            С чего начать
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {POPULAR_MODE_IDS.map((id) => {
              const mode = ALL_MODES.find((m) => m.id === id);
              if (!mode) return null;
              const active = ids.includes(id);
              const c = mode.groupColor; // CSS variable
              return (
                <div
                  key={id}
                  onClick={() => toggle(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: active ? cm(c, 9) : 'rgba(var(--fg-rgb),0.04)',
                    border: `1px solid ${active ? cm(c, 20) : 'rgba(var(--fg-rgb),0.08)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>
                    {mode.emoji}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: active ? 'var(--text)' : 'var(--text-sub)',
                        fontWeight: active ? 500 : 400,
                      }}
                    >
                      {mode.name}
                    </div>
                    {MODE_DESC[id] && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-sub)',
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {MODE_DESC[id]}
                      </div>
                    )}
                  </div>
                  {active && (
                    <span style={{ color: c, fontSize: 14, flexShrink: 0 }}>
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            height: 1,
            background: 'rgba(var(--fg-rgb),0.06)',
            marginBottom: 18,
          }}
        />
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: 14,
          }}
        >
          Все режимы
        </div>

        {MODE_GROUPS.map((group) => {
          const c = group.color; // CSS variable
          return (
            <div key={group.id} style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: c,
                  marginBottom: 8,
                  opacity: 0.8,
                }}
              >
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.items
                  .filter((m) => !POPULAR_MODE_IDS.includes(m.id))
                  .map((m) => {
                    const active = ids.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggle(m.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          background: active
                            ? cm(c, 9)
                            : 'rgba(var(--fg-rgb),0.03)',
                          border: `1px solid ${active ? cm(c, 20) : 'rgba(var(--fg-rgb),0.06)'}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>
                          {m.emoji}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              color: active ? 'var(--text)' : 'var(--text-sub)',
                              fontWeight: active ? 500 : 400,
                            }}
                          >
                            {m.name}
                          </div>
                          {MODE_DESC[m.id] && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-sub)',
                                marginTop: 2,
                                lineHeight: 1.4,
                              }}
                            >
                              {MODE_DESC[m.id]}
                            </div>
                          )}
                        </div>
                        {active && (
                          <span
                            style={{ color: c, fontSize: 14, flexShrink: 0 }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}

        <button
          onClick={() => {
            onSave(ids);
            onClose();
          }}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: 'none',
            background:
              'linear-gradient(135deg, var(--accent), var(--accent-blue))',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          Сохранить{ids.length > 0 ? ` (${ids.length})` : ''}
        </button>
      </div>
    </BottomSheet>
  );
}
