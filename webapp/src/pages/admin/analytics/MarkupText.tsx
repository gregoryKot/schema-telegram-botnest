import { parseTgMarkup } from './tgMarkup';

/** Текст отчёта: сегменты → span-ы, без innerHTML; code — моноширинный. */
export function MarkupText({ text }: { text: string }) {
  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parseTgMarkup(text).map((s, i) => (
        <span key={i} style={{
          fontWeight: s.b ? 700 : undefined, fontStyle: s.i ? 'italic' : undefined,
          fontFamily: s.code ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
        }}>{s.text}</span>
      ))}
    </div>
  );
}
