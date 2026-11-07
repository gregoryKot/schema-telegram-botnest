import type { CSSProperties, ReactNode } from 'react';
import type { ConceptGuideActions, ModeGuideView } from './conceptGuide';
import { MethodHint } from './MethodHint';
import { hintStyle, labelStyle } from './graphStyles';

const sectionStyle: CSSProperties = { marginTop: 'var(--space-8)' };

// Кнопка, которая выглядит словом: зона нажатия 44 по высоте, а в потоке —
// строка текста (отрицательные поля компенсируют рост, как retryStyle в
// SaveStatusLine). Цвет — текста, акцент на плашке один: «Взять за основу».
const wordBtn: CSSProperties = {
  minHeight: 44,
  margin: '-12px 0',
  padding: '0 2px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  font: 'inherit',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(var(--fg-rgb),0.3)',
  textUnderlineOffset: 3,
  cursor: 'pointer',
};
// «Дать заданием» стоит в своей строке, ей отрицательные поля не нужны.
const assignBtn: CSSProperties = {
  ...wordBtn,
  margin: 0,
  flexShrink: 0,
  color: 'var(--text-sub)',
};

/**
 * Плашка «Обычно в методе» для режима со своим разделом (#995): цель, техники
 * «На сессии», задания «Между сессиями» и «Подробнее». `take` — «Взять за
 * основу» (её показывает ConceptStrategy, пока поле пустое). Без `actions`
 * техники и задания — только текст, без кнопок.
 */
export function ConceptGuideHint({
  view,
  modeId,
  actions,
  take,
}: {
  view: ModeGuideView;
  modeId: string;
  actions?: ConceptGuideActions;
  take: ReactNode;
}) {
  const { guide, techniques } = view;
  const assign = actions?.onAssign;
  return (
    <MethodHint text={guide.goal} take={take}>
      {techniques.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>На сессии</div>
          <div
            style={{
              ...hintStyle,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '2px var(--space-10)',
            }}
          >
            {techniques.map((t) =>
              actions ? (
                <button
                  key={t.id}
                  type="button"
                  style={wordBtn}
                  onClick={() => actions.onOpenTechnique(t.id, modeId)}
                >
                  {t.name}
                </button>
              ) : (
                <span key={t.id} style={{ color: 'var(--text)' }}>
                  {t.name}
                </span>
              ),
            )}
          </div>
        </div>
      )}
      {guide.betweenSessions.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Между сессиями</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {guide.betweenSessions.map((item, i) => (
              <li
                key={`${i}:${item.title}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-8)',
                  minHeight: assign ? 44 : undefined,
                }}
              >
                <span style={{ ...hintStyle, color: 'var(--text)' }}>
                  {item.title}
                  {item.kind === 'task' && item.note && (
                    <span style={{ color: 'var(--text-sub)' }}>
                      {' '}
                      · {item.note}
                    </span>
                  )}
                </span>
                {assign && (
                  <button
                    type="button"
                    style={{ ...assignBtn, fontSize: 12 }}
                    aria-label={`Дать заданием: ${item.title}`}
                    onClick={() => assign(item, modeId)}
                  >
                    Дать заданием
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {actions && (
        <button
          type="button"
          style={{ ...wordBtn, margin: 0, fontSize: 13, fontWeight: 600 }}
          onClick={() => actions.onOpenMode(modeId)}
        >
          Подробнее о режиме
        </button>
      )}
    </MethodHint>
  );
}
