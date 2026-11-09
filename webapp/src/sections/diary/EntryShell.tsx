// Карточка записи ленты «Записей» (docs/design/APP_2026-11.md, b11): плоская бумага светлее страницы
// без обводки, корешок цвета типа слева, знак типа колонкой слева от текста (feedLook — тот же вид,
// что у строки задания и «Моего пути»), ярлык — тоном бумаги типа. Нажатие раскрывает поля и
// действия; раскрытая карточка поднимается тенью-слоем бумаги типа (client-diary-entry.css).
import { useState, type ReactNode } from 'react';
import { pressable } from '../../utils/a11y';
import { hueStyle } from '../../lib/tone';
import { EntryPreviewText } from './EntryPreviewText';
import { EntryKindChip, FeedSign } from './EntryKindChip';
import type { EntryKind } from './entryKind';
import type { FeedLook } from './feedLook';
import '../../styles/client-diary-entry.css';

export function EntryShell({ look, kind, title, time, text, preview, children }: {
  look: FeedLook; kind: EntryKind; title?: string; time?: string;
  /** Текст записи: длинный в закрытой карточке обрезается (EntryPreviewText). */
  text?: string | null;
  preview?: ReactNode; children?: (open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Обёртка — контейнер cd-entry: раскладка карточки по её ширине, а не страницы (лента и «Моя карточка»).
  return (
    <div className="cd-entry-box">
    <div className={'cd-entry' + (open ? ' is-open' : '')} style={hueStyle(look.hue)} aria-expanded={open} {...pressable(() => setOpen(v => !v))}>
      <FeedSign look={look} />
      <div className="cd-entry-body">
        <div className="cd-entry-head">
          <EntryKindChip kind={kind} />
          {time && <span className="cd-entry-time">{time}</span>}
        </div>
        {title && <div className="cd-entry-title">{title}</div>}
        <div className="cd-entry-text">{text && <EntryPreviewText text={text} open={open} />}{preview}</div>
        {children?.(open)}
      </div>
    </div>
    </div>
  );
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Раскрытая часть: поля записи, под ними действия одной строкой — «Поделиться» слева, «Удалить» тихо справа. */
export function EntryMore({ fields, share, remove }: { fields?: ReactNode; share?: ReactNode; remove: ReactNode }) {
  return (
    <div className="cd-entry-more" role="presentation" onClick={stop}>
      {fields}
      <div className="cd-entry-actions">{share && <div className="cd-entry-share">{share}</div>}{remove}</div>
    </div>
  );
}
