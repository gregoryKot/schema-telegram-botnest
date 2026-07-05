import { CYCLE, ICEBERG, MODES, ANX_DEP, TRAUMA, FORK, STEPS } from './article-diagrams.svg';

// slug → diagram HTML. Each built-in article gets a distinct diagram style.
export const ARTICLE_DIAGRAMS: Record<string, string> = {
  'chto-takoe-schema-terapiya': CYCLE,
  'skhemy-yanga-spisok': ICEBERG,
  'rezhimy-v-schema-terapii': MODES,
  'schema-terapiya-pri-trevoge-i-depressii': ANX_DEP,
  'schema-terapiya-pri-travme': TRAUMA,
  'podhodit-li-mne-schema-terapiya': FORK,
  'pervaya-sessiya-schema-terapii': STEPS,
};

/** Insert an article's diagram right after its first paragraph, if it has one. */
export function injectDiagram(slug: string, content: string): string {
  const diagram = ARTICLE_DIAGRAMS[slug];
  if (!diagram) return content;
  if (content.includes('class="dg"')) return content; // already has one
  const idx = content.indexOf('</p>');
  if (idx === -1) return diagram + content;
  const cut = idx + '</p>'.length;
  return content.slice(0, cut) + '\n' + diagram + content.slice(cut);
}
