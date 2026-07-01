import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { api } from '../../api';
import type { Article, ArticleDto } from '../../api';
import { card, btn, btnGhost, input } from './shared';

/** Create/edit form for a single article, with a TipTap WYSIWYG editor for the body. */
export function ArticleEditor({ adminKey, article, onDone, onCancel }: {
  adminKey: string; article: Article | null; onDone: () => void; onCancel: () => void;
}) {
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [title, setTitle] = useState(article?.title ?? '');
  const [description, setDescription] = useState(article?.description ?? '');
  const [date, setDate] = useState(article?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [readMin, setReadMin] = useState(article?.readMin ?? 5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: article?.content ?? '<p></p>',
  });

  const save = async () => {
    if (!slug.trim() || !title.trim()) { setError('Заполните заголовок и slug'); return; }
    setSaving(true);
    setError(null);
    const dto: ArticleDto = {
      slug: slug.trim(), title: title.trim(), description: description.trim(),
      content: editor?.getHTML() ?? '', date, readMin: Math.max(1, Math.round(readMin)),
    };
    try {
      if (article) await api.adminUpdateArticle(adminKey, article.id, dto);
      else await api.adminCreateArticle(adminKey, dto);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 16 }}>
        {article ? 'Редактировать статью' : 'Новая статья'}
      </h2>

      <Field label="Заголовок"><input style={input} value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="Slug (латиницей, для URL /articles/...)"><input style={input} value={slug} onChange={e => setSlug(e.target.value)} placeholder="moya-statya" /></Field>
      <Field label="Описание (для карточки и превью)">
        <textarea style={{ ...input, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} value={description} onChange={e => setDescription(e.target.value)} />
      </Field>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <Field label="Дата" style={{ flex: 1 }}><input style={input} type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Время чтения (мин)" style={{ width: 140 }}><input style={input} type="number" min={1} value={readMin} onChange={e => setReadMin(Number(e.target.value))} /></Field>
      </div>

      <Field label="Текст статьи">
        <div style={{ border: '1.5px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <EditorToolbar editor={editor} />
          <div style={{ padding: '12px 14px', maxHeight: 480, overflowY: 'auto' }}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </Field>

      {error && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: '8px 0' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button style={btn} onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
        <button style={btnGhost} onClick={onCancel}>Отмена</button>
      </div>

      <style>{`
        .ProseMirror { outline: none; font-size: 15px; line-height: 1.7; color: var(--text); min-height: 200px; }
        .ProseMirror h2 { font-family: var(--serif); font-size: 22px; font-weight: 400; margin: 20px 0 8px; }
        .ProseMirror h3 { font-family: var(--serif); font-size: 18px; font-weight: 400; margin: 16px 0 6px; }
        .ProseMirror p { margin: 0 0 10px; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 20px; margin: 0 0 10px; }
      `}</style>
    </section>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const tbBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-sub)',
    border: 'none', borderRadius: 6,
  });
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '8px 10px', borderBottom: '1.5px solid var(--line)', background: 'rgba(var(--fg-rgb),0.02)' }}>
      <button type="button" style={tbBtn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>Ж</button>
      <button type="button" style={tbBtn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>К</i></button>
      <button type="button" style={tbBtn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button type="button" style={tbBtn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      <button type="button" style={tbBtn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Список</button>
      <button type="button" style={tbBtn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Список</button>
      <button type="button" style={tbBtn(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</button>
      <button type="button" style={tbBtn(false)} onClick={() => editor.chain().focus().undo().run()}>↶</button>
      <button type="button" style={tbBtn(false)} onClick={() => editor.chain().focus().redo().run()}>↷</button>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
