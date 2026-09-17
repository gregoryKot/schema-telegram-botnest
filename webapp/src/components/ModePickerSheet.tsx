import { GlyphArrowLeft } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { MODE_GROUPS, ALL_MODES } from '../schemaTherapyData';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
import { pressable } from '../utils/a11y';
import {
  MODE_DESC,
  POPULAR_MODE_IDS,
} from '../../../shared/src/mode/modePickerDesc';
import { useAutosavedSelection } from '../../../shared/src/hooks/useAutosavedSelection';

/** color-mix: works with CSS vars AND hex. Replaces the old hex-alpha hack. */
function cm(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

// Выбиралка режимов — вынесена из SchemasSection.tsx (правило №10, потолок
// файла). Шапка уже была липкой (единственная из двух webapp-выбиралок) —
// сохранён её вид, кнопка теперь только закрывает (автосохранение —
// useAutosavedSelection, жалоба пользователя, закрытый PR #237).
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
  const goBack = useHistorySheet(onClose);
  const { ids, toggle } = useAutosavedSelection(selected, onSave);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="ex-btn ex-btn-ghost" onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
        <button onClick={goBack} className="ex-btn ex-btn-primary" style={{ padding: '7px 20px' }}>
          Готово{ids.length > 0 ? ` · ${ids.length}` : ''}
        </button>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>Мои режимы</h1>
        <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 24, lineHeight: 1.6 }}>
          {tr('Выбери режимы которые ты замечаешь у себя. Выбор сохраняется сразу.', 'Выберите режимы которые вы замечаете у себя. Выбор сохраняется сразу.')}
        </p>

        <div style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            С чего начать
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {POPULAR_MODE_IDS.map(id => {
              const mode = ALL_MODES.find(m => m.id === id);
              if (!mode) return null;
              const active = ids.includes(id);
              const c = mode.groupColor; // CSS variable
              return (
                <div key={id} {...pressable(() => toggle(id))} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', padding: '10px 12px', borderRadius: 'var(--r-12)', cursor: 'pointer', background: active ? cm(c, 9) : 'rgba(var(--fg-rgb),0.04)', border: `1px solid ${active ? cm(c, 20) : 'rgba(var(--fg-rgb),0.08)'}`, transition: 'all 0.15s' }}>
                  <IdentityDot color={c} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: active ? 'var(--text)' : 'var(--text-sub)', fontWeight: active ? 500 : 400 }}>{mode.name}</div>
                    {MODE_DESC[id] && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2, lineHeight: 1.4 }}>{MODE_DESC[id]}</div>}
                  </div>
                  {active && <span style={{ color: c, fontSize: 14, flexShrink: 0 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(var(--fg-rgb),0.06)', marginBottom: 16 }} />
        <div className="eyebrow" style={{ marginBottom: 14 }}>Все режимы</div>

        {MODE_GROUPS.map(group => {
          const c = group.color; // CSS variable
          return (
            <div key={group.id} style={{ marginBottom: 16 }}>
              <div className="eyebrow" style={{ color: c, marginBottom: 8, opacity: 0.8 }}>
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {group.items.filter(m => !POPULAR_MODE_IDS.includes(m.id)).map(m => {
                  const active = ids.includes(m.id);
                  return (
                    <div key={m.id} {...pressable(() => toggle(m.id))} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', padding: '10px 12px', borderRadius: 'var(--r-12)', cursor: 'pointer', background: active ? cm(c, 9) : 'rgba(var(--fg-rgb),0.03)', border: `1px solid ${active ? cm(c, 20) : 'rgba(var(--fg-rgb),0.06)'}`, transition: 'all 0.15s' }}>
                      <IdentityDot color={c} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: active ? 'var(--text)' : 'var(--text-sub)', fontWeight: active ? 500 : 400 }}>{m.name}</div>
                        {MODE_DESC[m.id] && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2, lineHeight: 1.4 }}>{MODE_DESC[m.id]}</div>}
                      </div>
                      {active && <span style={{ color: c, fontSize: 14, flexShrink: 0 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
