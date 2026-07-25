import { useState } from 'react';
import { pressable } from '../../utils/a11y';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { MODE_TEST_GROUPS } from '../../../../shared/src/mode/modeTest';

/**
 * Тест «какой режим включился» — определение по функции (2 уровня).
 * Уровень 1: крупное «что со мной сейчас» → уровень 2: уточнение → onResolve(modeId).
 * Заменяет свалку 35 режимов на пути новичка. Данные — shared/mode/modeTest.
 */
export function ModeTestSheet({
  onResolve,
  onClose,
}: {
  onResolve: (modeId: string) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const [groupId, setGroupId] = useState<string | null>(null);
  const group = MODE_TEST_GROUPS.find((g) => g.id === groupId) ?? null;

  return (
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
      {...pressable(onClose)}
      aria-label="Закрыть"
    >
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--sheet-bg)',
          borderRadius: '24px 24px 0 0',
          padding: '20px 20px 40px',
          maxHeight: '86vh',
          overflowY: 'auto',
          animation: 'sheet-up 300ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(var(--fg-rgb),0.12)',
            margin: '0 auto 16px',
          }}
        />

        {!group ? (
          <>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text)',
                textAlign: 'center',
              }}
            >
              {tr('Что с тобой сейчас?', 'Что с вами сейчас?')}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                textAlign: 'center',
                margin: '4px 0 18px',
              }}
            >
              {tr(
                'Выбери самое близкое — потом уточним',
                'Выберите самое близкое — потом уточним',
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MODE_TEST_GROUPS.map((g) => (
                <div
                  key={g.id}
                  {...pressable(() => {
                    haptic.select();
                    setGroupId(g.id);
                  })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'rgba(var(--fg-rgb),0.05)',
                    border: '1px solid rgba(var(--fg-rgb),0.06)',
                    borderRadius: 16,
                    padding: '13px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{g.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {g.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                      {g.hint}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                haptic.tap();
                setGroupId(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: 'var(--text-sub)',
                fontSize: 14,
                cursor: 'pointer',
                padding: 0,
                marginBottom: 14,
                fontFamily: 'inherit',
              }}
            >
              ← {tr('назад', 'назад')}
            </button>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 4,
              }}
            >
              {group.emoji} {group.title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginBottom: 16,
              }}
            >
              {tr('Что ближе всего?', 'Что ближе всего?')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.leaves.map((l) => (
                <div
                  key={l.modeId}
                  {...pressable(() => {
                    haptic.success();
                    onResolve(l.modeId);
                  })}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    background: 'rgba(var(--fg-rgb),0.05)',
                    border: '1px solid rgba(var(--fg-rgb),0.06)',
                    borderRadius: 14,
                    padding: '13px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>
                    {l.emoji}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {l.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-sub)',
                        lineHeight: 1.5,
                        marginTop: 3,
                      }}
                    >
                      {l.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
