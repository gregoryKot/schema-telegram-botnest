import { BottomSheet } from './BottomSheet';
import { PickerStickyHeader } from './PickerStickyHeader';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { useTr } from '../utils/addressForm';
import { useAutosavedSelection } from '../../../shared/src/hooks/useAutosavedSelection';

interface Props {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

export function SchemaPickerSheet({ selected, onSave, onClose }: Props) {
  const tr = useTr();
  const { ids, toggle } = useAutosavedSelection(selected, onSave);

  return (
    <BottomSheet onClose={onClose}>
      <div className="u-pt4">
        <PickerStickyHeader
          title="Мои схемы"
          hint="Выбор сохраняется сразу"
          count={ids.length}
          onDone={onClose}
        />
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {tr(
            'Выбери схемы, которые тебе близки. Можно без теста — если ты уже знаешь свои.',
            'Выберите схемы, которые вам близки. Можно без теста — если вы уже знаете свои.',
          )}
        </div>

        {SCHEMA_DOMAINS.map((domain) => (
          <div key={domain.id} className="u-mb18">
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: domain.color,
                marginBottom: 8,
                opacity: 0.8,
              }}
            >
              {domain.domain}
            </div>
            <div className="u-col4">
              {domain.schemas.map((s) => {
                const active = ids.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle(s.id);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-10)',
                      padding: '10px 12px',
                      borderRadius: 'var(--r-12)',
                      cursor: 'pointer',
                      background: active
                        ? `${domain.color}12`
                        : 'rgba(var(--fg-rgb),0.03)',
                      border: `1px solid ${active ? `${domain.color}30` : 'rgba(var(--fg-rgb),0.06)'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: active
                          ? domain.color
                          : 'rgba(var(--fg-rgb),0.2)',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div className="u-fill">
                      <div
                        style={{
                          fontSize: 14,
                          color: active
                            ? 'var(--text)'
                            : 'rgba(var(--fg-rgb),0.6)',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {s.name}
                      </div>
                      {s.desc && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-sub)',
                            marginTop: 2,
                            lineHeight: 1.4,
                          }}
                        >
                          {s.desc}
                        </div>
                      )}
                    </div>
                    {active && (
                      <span
                        style={{
                          color: domain.color,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
