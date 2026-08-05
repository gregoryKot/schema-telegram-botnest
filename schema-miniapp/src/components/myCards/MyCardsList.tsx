// Список заполненных карточек-заметок (схема/режим) — одна механика для
// обеих вкладок «Паттернов» (правило «одна механика — один компонент»).
// Строка: цветная точка домена/группы + название + выжимка первого
// заполненного поля. Тап по строке — открыть/редактировать существующим
// шитом (SchemaIntroSheet/ModeIntroSheet, см. MyCardsSection), отдельная
// кнопка — поделиться именно этой карточкой.
import { pressable } from '../../utils/a11y';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { SharePill } from '../../share/SharePill';
import type { NoteCardField } from '../../../../shared/src/share/cards/noteCard';

export interface MyCardItem {
  id: string;
  name: string;
  subtitle?: string;
  color: string;
  /** Текст первого заполненного поля — выжимка для строки списка. */
  excerpt: string;
  /** Все заполненные поля, уже готовые для drawNoteCard. */
  cardFields: NoteCardField[];
}

interface Props {
  items: MyCardItem[];
  onOpen: (id: string) => void;
  onShare: (item: MyCardItem) => void;
}

export function MyCardsList({ items, onOpen, onShare }: Props) {
  return (
    <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <div
          key={it.id}
          {...pressable(() => onOpen(it.id))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 64,
            padding: '12px 14px',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-color)',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <IdentityDot color={it.color} size={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}
            >
              {it.name}
            </div>
            {it.excerpt && (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-sub)',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {it.excerpt}
              </div>
            )}
          </div>
          {/* stopPropagation — иначе клик по «Поделиться» ещё и открывает
              редактор строки под ним (событие всплывает к pressable-обёртке).
              Подпись обязательна — значок без неё уже убирали как непонятный. */}
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            style={{ flexShrink: 0 }}
          >
            <SharePill onClick={() => onShare(it)} />
          </div>
        </div>
      ))}
    </div>
  );
}
