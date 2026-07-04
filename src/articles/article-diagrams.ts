// Inline SVG diagrams embedded into article content. Each is a self-contained
// <figure> that themes itself via the .dg-* classes styled in ArticlesPage.
// Kept server-side so the version-gated re-seed can refresh built-in articles.
//
// Design rules (learned the hard way): generous box widths, short labels, no
// <marker> elements (arrowheads are explicit polygons so the sanitizer keeps
// them). Coordinates are chosen to keep every label inside its box.

const cycle = `
<figure class="dg">
  <svg viewBox="0 0 640 400" role="img" aria-label="Порочный круг схемы">
    <rect class="dg-accent" x="24" y="24" width="176" height="54" rx="14"/>
    <text class="dg-t-on" x="112" y="47" text-anchor="middle">Триггер</text>
    <text class="dg-s-on" x="112" y="65" text-anchor="middle">внешняя ситуация</text>
    <path class="dg-flow" d="M200,54 C260,58 300,74 326,110"/>
    <polygon class="dg-head" points="326,110 316,104 328,99"/>
    <rect class="dg-node" x="235" y="112" width="212" height="60" rx="16"/>
    <text class="dg-t" x="341" y="138" text-anchor="middle">Схема</text>
    <text class="dg-s" x="341" y="157" text-anchor="middle">«меня бросят»</text>
    <rect class="dg-node" x="410" y="286" width="212" height="60" rx="16"/>
    <text class="dg-t" x="516" y="312" text-anchor="middle">Режим</text>
    <text class="dg-s" x="516" y="331" text-anchor="middle">Уязвимый ребёнок</text>
    <rect class="dg-node" x="60" y="286" width="212" height="60" rx="16"/>
    <text class="dg-t" x="166" y="312" text-anchor="middle">Поведение</text>
    <text class="dg-s" x="166" y="331" text-anchor="middle">цепляние, ревность</text>
    <path class="dg-flow" d="M447,160 C545,186 560,240 542,280"/>
    <polygon class="dg-head" points="542,280 536,268 549,270"/>
    <path class="dg-flow" d="M408,326 C356,342 316,342 278,332"/>
    <polygon class="dg-head" points="278,332 290,327 289,340"/>
    <path class="dg-flow-soft" d="M112,284 C82,232 118,182 233,153"/>
    <polygon class="dg-head-soft" points="233,153 221,152 227,142"/>
    <text class="dg-lbl" x="70" y="235" text-anchor="middle" transform="rotate(-72 70 235)">подкрепляет</text>
  </svg>
  <figcaption><b>Порочный круг схемы.</b> Триггер запускает убеждение → режим → поведение, а поведение снова подтверждает убеждение. Схема-терапия разрывает этот круг.</figcaption>
</figure>`;

const iceberg = `
<figure class="dg">
  <svg viewBox="0 0 640 380" role="img" aria-label="Айсберг: видимое и скрытое">
    <rect class="dg-water" x="0" y="150" width="640" height="230"/>
    <line class="dg-waterline" x1="0" y1="150" x2="640" y2="150"/>
    <polygon class="dg-ice" points="320,40 250,150 390,150"/>
    <polygon class="dg-ice-sub" points="250,150 390,150 430,300 210,300"/>
    <text class="dg-cap" x="470" y="72">НАД ВОДОЙ · ВИДНО</text>
    <text class="dg-t" x="470" y="98">Симптомы</text>
    <text class="dg-s" x="470" y="118">тревога · конфликты · срывы</text>
    <text class="dg-cap-acc" x="40" y="198">ПОД ВОДОЙ · СКРЫТО</text>
    <text class="dg-t" x="40" y="224">Схемы и детский опыт</text>
    <text class="dg-s" x="40" y="244">убеждения о себе и мире</text>
    <text class="dg-s" x="40" y="264">неудовлетворённые потребности</text>
    <text class="dg-t-acc" x="320" y="242" text-anchor="middle">18 схем</text>
  </svg>
  <figcaption><b>То, что на поверхности — лишь верхушка.</b> Симптомы видно сразу, но корни (схемы, детский опыт) скрыты под водой. Схема-терапия работает с тем, что ниже.</figcaption>
</figure>`;

const modes = `
<figure class="dg">
  <svg viewBox="0 0 640 300" role="img" aria-label="Четыре группы режимов">
    <rect class="dg-node" x="14" y="14" width="300" height="118" rx="16"/>
    <text class="dg-cap-acc" x="34" y="42">РЕБЁНОК</text>
    <text class="dg-t" x="34" y="72">Уязвимый · Злой</text>
    <text class="dg-s" x="34" y="94">боль, страх, гнев,</text>
    <text class="dg-s" x="34" y="112">ощущение несправедливости</text>
    <rect class="dg-node" x="326" y="14" width="300" height="118" rx="16"/>
    <text class="dg-cap-acc" x="346" y="42">ДИСФУНКЦ. РОДИТЕЛЬ</text>
    <text class="dg-t" x="346" y="72">Карающий · Требующий</text>
    <text class="dg-s" x="346" y="94">внутренний критик,</text>
    <text class="dg-s" x="346" y="112">«ты недостаточно хорош»</text>
    <rect class="dg-node" x="14" y="146" width="300" height="118" rx="16"/>
    <text class="dg-cap-acc" x="34" y="174">КОПИНГИ</text>
    <text class="dg-t" x="34" y="204">Защитник · Капитулянт</text>
    <text class="dg-s" x="34" y="226">избегание, отключение,</text>
    <text class="dg-s" x="34" y="244">гиперкомпенсация</text>
    <rect class="dg-accent" x="326" y="146" width="300" height="118" rx="16"/>
    <text class="dg-cap-on" x="346" y="174">ЦЕЛЬ ТЕРАПИИ</text>
    <text class="dg-t-on" x="346" y="204">Здоровый взрослый</text>
    <text class="dg-s-on" x="346" y="226">заботится о ребёнке,</text>
    <text class="dg-s-on" x="346" y="244">противостоит критику</text>
  </svg>
  <figcaption><b>Карта режимов.</b> Три группы «рабочих» состояний и одно ресурсное — Здоровый взрослый, который развивается в терапии.</figcaption>
</figure>`;

// slug → diagram HTML. Only these built-in articles get a diagram (for now).
export const ARTICLE_DIAGRAMS: Record<string, string> = {
  'chto-takoe-schema-terapiya': cycle,
  'skhemy-yanga-spisok': iceberg,
  'rezhimy-v-schema-terapii': modes,
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
