import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { useAboutText, NEEDS_EXPLAINER } from '../aboutData';
import { pressable } from '../utils/a11y';

// «Зачем это всё» — содержимое sheets.about. Перенесено из App.tsx как есть
// (этап 3 REMEDIATION_PLAN), ABOUT_TEXT берётся хуком на месте вместо пропа.
export function AboutSheet({
  onClose,
  onOpenSchemaInfo,
}: {
  onClose: () => void;
  onOpenSchemaInfo: () => void;
}) {
  const ABOUT_TEXT = useAboutText();

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 8 }}>
        <SectionLabel purple mb={16}>
          Зачем это всё
        </SectionLabel>
        {ABOUT_TEXT.map((p, i) => (
          <p
            key={i}
            style={{
              fontSize: 15,
              color: 'rgba(var(--fg-rgb),0.8)',
              lineHeight: 1.7,
              marginBottom: 16,
            }}
          >
            {p}
          </p>
        ))}

        <SectionLabel mb={12}>Пять потребностей</SectionLabel>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 24,
          }}
        >
          {NEEDS_EXPLAINER.map((n) => (
            <div
              key={n.name}
              style={{
                background: 'rgba(var(--fg-rgb),0.04)',
                border: '1px solid rgba(var(--fg-rgb),0.07)',
                borderRadius: 14,
                padding: '12px 14px',
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
                <span style={{ fontSize: 18 }}>{n.emoji}</span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  {n.name}
                </span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {n.text}
              </p>
            </div>
          ))}
        </div>

        <div
          {...pressable(onOpenSchemaInfo)}
          style={{
            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
            borderRadius: 14,
            padding: '14px 16px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              Схема-терапия
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-sub)',
                marginTop: 2,
              }}
            >
              Схемы, режимы, потребности
            </div>
          </div>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </BottomSheet>
  );
}
