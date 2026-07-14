// Which built-in diagram each seeded article uses. The actual SVG lives on the
// frontend (webapp/src/pages/articleDiagrams.ts) and is rendered client-side —
// kept OUT of the editable `content` so the WYSIWYG editor can't strip it when
// the admin edits an article.
export const ARTICLE_DIAGRAM_KEYS: Record<string, string> = {
  'skolko-dlitsya-schema-terapiya': 'duration',
  'chto-takoe-schema-terapiya': 'cycle',
  'skhemy-yanga-spisok': 'iceberg',
  'rezhimy-v-schema-terapii': 'modes',
  'schema-terapiya-pri-trevoge-i-depressii': 'anx-dep',
  'schema-terapiya-pri-travme': 'trauma',
  'podhodit-li-mne-schema-terapiya': 'fork',
  'pervaya-sessiya-schema-terapii': 'steps',
  'schema-terapiya-vs-kpt': 'layers',
  'povtoryayushchiesya-patterny-v-otnosheniyah': 'relations',
};
