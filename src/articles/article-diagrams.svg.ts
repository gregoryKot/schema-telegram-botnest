// SVG diagram markup for articles. Data only — logic (slug map, injection) lives
// in article-diagrams.ts. Each is a self-contained <figure class="dg"> that
// themes itself via the .dg-* classes styled in ArticlesPage.
//
// Rules: generous box widths, short labels, no <marker> (arrowheads are
// polygons so the sanitizer keeps them), coordinates keep every label in bounds.

export const CYCLE = `
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

export const ICEBERG = `
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

export const MODES = `
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

// Which schemas sit behind anxiety vs behind depression — two-column map.
export const ANX_DEP = `
<figure class="dg">
  <svg viewBox="0 0 640 258" role="img" aria-label="Схемы за тревогой и за депрессией">
    <rect class="dg-node" x="14" y="14" width="300" height="230" rx="16"/>
    <text class="dg-cap-acc" x="34" y="44">ЗА ТРЕВОГОЙ</text>
    <rect class="dg-chip" x="30" y="60" width="268" height="34" rx="9"/>
    <text class="dg-s" x="46" y="82">Уязвимость к опасности</text>
    <rect class="dg-chip" x="30" y="102" width="268" height="34" rx="9"/>
    <text class="dg-s" x="46" y="124">Покинутость</text>
    <rect class="dg-chip" x="30" y="144" width="268" height="34" rx="9"/>
    <text class="dg-s" x="46" y="166">Жёсткие стандарты</text>
    <rect class="dg-chip" x="30" y="186" width="268" height="34" rx="9"/>
    <text class="dg-s" x="46" y="208">Негативизм / пессимизм</text>
    <rect class="dg-node" x="326" y="14" width="300" height="230" rx="16"/>
    <text class="dg-cap-acc" x="346" y="44">ЗА ДЕПРЕССИЕЙ</text>
    <rect class="dg-chip" x="342" y="60" width="268" height="34" rx="9"/>
    <text class="dg-s" x="358" y="82">Дефективность / стыд</text>
    <rect class="dg-chip" x="342" y="102" width="268" height="34" rx="9"/>
    <text class="dg-s" x="358" y="124">Эмоциональная депривация</text>
    <rect class="dg-chip" x="342" y="144" width="268" height="34" rx="9"/>
    <text class="dg-s" x="358" y="166">Неудача</text>
    <rect class="dg-chip" x="342" y="186" width="268" height="34" rx="9"/>
    <text class="dg-s" x="358" y="208">Подчинение · Карающий родитель</text>
  </svg>
  <figcaption><b>У симптома есть адрес.</b> Когда понятно, какая схема подпитывает тревогу или спад, становится ясно, куда прикладывать усилия.</figcaption>
</figure>`;

// Shock vs developmental trauma — comparison, schema therapy shines on the right.
export const TRAUMA = `
<figure class="dg">
  <svg viewBox="0 0 640 250" role="img" aria-label="Шоковая травма и травма развития">
    <rect class="dg-node" x="14" y="14" width="300" height="222" rx="16"/>
    <text class="dg-cap-acc" x="34" y="44">ШОКОВАЯ · ТИП I</text>
    <text class="dg-t" x="34" y="76">Одно событие</text>
    <text class="dg-s" x="34" y="100">авария, потеря, нападение</text>
    <text class="dg-s" x="34" y="124">→ классическое ПТСР</text>
    <text class="dg-cap" x="34" y="164">ПЕРВАЯ ЛИНИЯ</text>
    <text class="dg-s" x="34" y="188">EMDR, травмофокус. КПТ</text>
    <rect class="dg-accent" x="326" y="14" width="300" height="222" rx="16"/>
    <text class="dg-cap-on" x="346" y="44">РАЗВИТИЯ · ТИП II</text>
    <text class="dg-t-on" x="346" y="76">Длится годами</text>
    <text class="dg-s-on" x="346" y="100">пренебрежение, нестабильность</text>
    <text class="dg-s-on" x="346" y="124">→ комплексное ПТСР</text>
    <text class="dg-cap-on" x="346" y="164">ЗДЕСЬ ОСОБЕННО СИЛЬНА</text>
    <text class="dg-t-on" x="346" y="190">Схема-терапия</text>
  </svg>
  <figcaption><b>Травма травме рознь.</b> При одном остром событии первой линией идут EMDR и травмофокусированная КПТ; при хронической травме развития раскрывается схема-терапия.</figcaption>
</figure>`;

// Three self-check questions → schema therapy or another approach.
export const FORK = `
<figure class="dg">
  <svg viewBox="0 0 640 300" role="img" aria-label="Подходит ли мне схема-терапия">
    <rect class="dg-node" x="180" y="14" width="280" height="58" rx="16"/>
    <text class="dg-t" x="320" y="49" text-anchor="middle">Три вопроса о себе</text>
    <path class="dg-flow" d="M260,72 C210,110 180,140 165,176"/>
    <polygon class="dg-head" points="165,176 162,163 174,168"/>
    <path class="dg-flow-soft" d="M380,72 C430,110 460,140 475,176"/>
    <polygon class="dg-head-soft" points="475,176 466,168 478,163"/>
    <rect class="dg-accent" x="34" y="178" width="268" height="104" rx="16"/>
    <text class="dg-cap-on" x="54" y="206">СКОРЕЕ ДА</text>
    <text class="dg-t-on" x="54" y="234">Схема-терапия — ваш метод</text>
    <text class="dg-s-on" x="54" y="258">про «всю жизнь», понимание</text>
    <text class="dg-s-on" x="54" y="274">не помогает, готов к работе</text>
    <rect class="dg-node" x="338" y="178" width="268" height="104" rx="16"/>
    <text class="dg-cap-acc" x="358" y="206">СКОРЕЕ НЕТ</text>
    <text class="dg-t" x="358" y="234">Начать с другого</text>
    <text class="dg-s" x="358" y="258">острый/точечный запрос,</text>
    <text class="dg-s" x="358" y="274">кризис, нет ресурса</text>
  </svg>
  <figcaption><b>Как понять про себя.</b> Чем больше «так со мной всю жизнь» и «понимание уже не помогает» — тем больше показаний к схема-терапии.</figcaption>
</figure>`;

// First-session steps — vertical numbered timeline.
export const STEPS = `
<figure class="dg">
  <svg viewBox="0 0 640 350" role="img" aria-label="Шаги первой сессии">
    <line class="dg-flow-soft" x1="40" y1="40" x2="40" y2="310"/>
    <circle class="dg-accent" cx="40" cy="40" r="17"/>
    <text class="dg-t-on" x="40" y="45" text-anchor="middle">1</text>
    <text class="dg-t" x="74" y="36">Разговор о запросе</text>
    <text class="dg-s" x="74" y="56">своими словами, без подготовки</text>
    <circle class="dg-accent" cx="40" cy="107" r="17"/>
    <text class="dg-t-on" x="40" y="112" text-anchor="middle">2</text>
    <text class="dg-t" x="74" y="103">Немного истории</text>
    <text class="dg-s" x="74" y="123">мягко и в вашем темпе, не допрос</text>
    <circle class="dg-accent" cx="40" cy="174" r="17"/>
    <text class="dg-t-on" x="40" y="179" text-anchor="middle">3</text>
    <text class="dg-t" x="74" y="170">Язык метода</text>
    <text class="dg-s" x="74" y="190">что такое схема и режим</text>
    <circle class="dg-accent" cx="40" cy="241" r="17"/>
    <text class="dg-t-on" x="40" y="246" text-anchor="middle">4</text>
    <text class="dg-t" x="74" y="237">Иногда опросники</text>
    <text class="dg-s" x="74" y="257">карта, а не экзамен</text>
    <circle class="dg-accent" cx="40" cy="308" r="17"/>
    <text class="dg-t-on" x="40" y="313" text-anchor="middle">5</text>
    <text class="dg-t" x="74" y="304">Цели и формат</text>
    <text class="dg-s" x="74" y="324">как часто встречаться и горизонт</text>
  </svg>
  <figcaption><b>Первая встреча — это разговор, а не процедура.</b> Понять друг друга и наметить дорогу; дальше — по шагам, в вашем темпе.</figcaption>
</figure>`;
