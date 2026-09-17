# Игра: арт-бриф — что перерисовать и промпты для генерации

Продолжение [GAME_ANALYSIS.md](GAME_ANALYSIS.md) и [GAME_IMPROVEMENT_PLAN.md](GAME_IMPROVEMENT_PLAN.md).
Анализ смотрел на сюжет, интерес, терапию и качество; картинку он задел
только по касательной (К4 читаемость, К8 вес спрайтов). Этот документ — про
картинку целиком: что именно выглядит плохо, каким должен быть один стиль на
всю игру и какие ассеты в каком порядке генерировать. Каждое ТЗ привязано к
коду: размер кадра, имя файла, куда положить, что поменять в `game/src`.

Ассеты можно генерировать в любом количестве, поэтому дефицит не в картинках,
а в согласованности. Принцип документа: **сначала один эталон стиля, потом
всё остальное по нему** — иначе получится ещё один коллаж, только дороже.

Скриншоты, по которым писался диагноз: headless-Chromium 1280×720, сборка
ветки `main` от 2026-09-07 (после #475). Снимались стартовый экран, обучение,
главы 1–4 в трёх точках каждая, экран «сил не осталось».

## 1. Диагноз: почему игра выглядит плохо

Коротко: в одном кадре живут четыре разных техники рисования, а фон, на
который смотрят 90 % времени, нарисован прямоугольниками из кода.

1. **Четыре стиля в одном кадре — главная проблема.** Кот Мистер — ручной
   пиксель-арт 48×48 (`cat_run.png` 288×48, 6 кадров; `cat_idle.png`
   576×48, 12 кадров). Позы копингов — сгенерированные картинки 257×257,
   190×190, 269×269 (`cat_play`, `cat_sleep`, `cat_dash`), которые код
   уменьшает в 3–4 раза (`setScale(0.24…0.3)`): сглаженные края, другая
   толщина линий, кот вдруг становится 60–70 px вместо 48. Враги —
   генерированные раскрашенные картинки 60–160 px с тенями и градиентами.
   Реквизит (диван 429×197, лампа 118×369, дверь 245×363) — полутоновая
   живопись. А дома, окна, деревья, дорога, свет фонарей — `fillRect` и
   `fillCircle` из `decor.ts`. Глаз читает это как аппликацию из журналов.
2. **Фон пустой.** Улица гл. 1 — ряд плоских прямоугольников с жёлтыми
   квадратиками окон (`buildStreet`). Дорога гл. 3 — круги на палках вместо
   деревьев (`tree()`), кресты столбов, огромное пустое небо. Комната гл. 2 —
   без стен, обоев, плинтуса, картин: реквизит стоит на бежевой полосе в
   темноте. Параллакс есть только у дальнего слоя (`scrollFactor` 0.25/0.18),
   среднего плана нет вовсе — ощущение, что бежишь по декорации.
3. **Платформы-«карнизы» висят в воздухе.** `NineSlice` из полосы 28 px с
   колпаками 30–34 px (`ledge_*.png`): середина тянется и «мажет», травяные
   пятна повторяются, в комнате это летающие скамейки без опоры. Нет ответа
   «на чём это держится» — карниз, полка, ветка, кронштейн.
4. **Пол — процедурная полоска.** `BootScene.drawGround/drawPlat` рисуют
   16×16 из двух цветов: зелёная кромка и коричневый низ, в комнате —
   бежевая доска. Ни асфальта, ни паркета, ни тени под ногами.
5. **Враги мелкие и без состояний.** Тревога — тёмный клубок с глазами ~40 px,
   раздражение — огненный шар: читаются, но рядом с 48-px котом это «мазки».
   Состояния (ударен, успокоен, замер) переданы только тинтом цвета; кадров
   у каждого 3–4, все — idle.
6. **Терапевт — тот же кот с зелёным тинтом** (GAME_ANALYSIS, гл. 4).
   Кульминация всей игры визуально не отличается от врага и игрока. Это
   вопрос 5 владельцу в плане (портрет); здесь дан вариант по умолчанию.
7. **Шрифт и HUD.** Press Start 2P 8–11 px с кириллицей — тонкие «ломаные»
   штрихи (К4), сердца похожи на эмодзи, счётчик «✦ 0/8» серый и незаметный.
   Кнопка «НАЧАТЬ» — прямоугольник с рамкой.
8. **Стартовый экран и экран смерти пустые.** Коричневый или чёрный фон,
   заголовок, один кот 48 px в центре. Первое, что видит человек, — ничего.
9. **Свет — пятна.** «Островки» фонарей и лампы — полупрозрачные эллипсы
   поверх сцены (`fillEllipse`), в кабинете гл. 4 это большой бежевый овал
   над диваном. Свет должен быть частью спрайта и фона, а не наложением.
10. **Стоп-кадры знакомства — текст на затемнении.** Ни рамки, ни портрета
    врага; при быстром проходе двух триггеров подряд два стоп-кадра
    накладываются друг на друга (замечено на гл. 3 при телепорте через
    триггеры 2600 и 3200 — в живой игре маловероятно, но защиты нет; см.
    «Следующие шаги»).

Что уже хорошо и остаётся: сам кот (силуэт, жёлтые глаза, походка), фонарь
`prop_streetlamp`, торшер `prop_lamp`, диван `prop_couch` как форма, палитры
глав в `chapters.ts` (сумеречный фиолет улицы, тёплая комната, рассвет дороги),
идея «мотыльков» в воздухе. Это опоры стиля, а не мусор.

## 2. Целевой стиль — одно решение на всё

**Жанр:** пиксель-арт «16 бит» с современной палитрой (ориентиры по
настроению: Celeste, Hyper Light Drifter, Kingdom: Two Crowns — сумерки,
мягкий контровой свет, чистые контуры). Не «8 бит из четырёх цветов» и не
раскрашенная иллюстрация.

**Масштаб:** 1 пиксель ассета = 1 пиксель канваса 960×540. Ничего не
уменьшать кодом больше чем вдвое и ничего не увеличивать дробно. Эталон
роста — кот 48 px (высота в кадре ~40 px без ушей). Враги 40–72 px, критик
56 px, реквизит в масштабе комнаты (диван ~120 px шириной, торшер ~110 px
высотой, дверь ~130 px).

**Линии:** контур 1 px, цвет контура — не чёрный, а тёмный оттенок объекта
(`#1a1426` для холодных, `#2a1a12` для тёплых). Без сглаживания, без
градиентов, тени — дизерингом не более двух тонов.

**Свет:** один источник сверху-слева на всех спрайтах. Свет фонарей и ламп —
внутри спрайта (тёплый ореол 2–3 тона), а не эллипсом поверх.

**Палитра (32 цвета максимум на спрайт, общий набор):**

| Роль | Цвета |
|---|---|
| Ночное небо улицы (гл. 1) | `#2c2348` → `#5e4878`, свечение `#9a6aaa` / `#b07ab2` |
| Тёплая комната (гл. 2, 4) | стены `#342b3e` → `#5a4a52`, лампа `#ffd080`, дерево `#9a6e54` / `#e8cda0` |
| Дорога и рассвет (гл. 3) | `#3a3458` → `#6a5a82`, рассвет `#ffe6b0`, зелень `#3f5036` / `#35422e` |
| Кот Мистер | шерсть `#1a1a22` / `#2b2b36`, блик `#4a4a5c`, глаза `#ffcc33`, нос `#d9738a` |
| Акценты интерфейса | бирюза `#88ffcc`, коралл `#ff7733`, опасность `#ff7799`, золото `#ffd86a`, сирень текста `#a89fd0` |
| Враги | тревога `#3a3550` + глаза `#ffd86a`; прокрастинация `#6a6a80` дым; телефон `#2a2f44` + экран `#8ad8ff`; раздражение `#ff5a2a` / `#ffb040`; дела `#e8dcc0` бумага; критик — силуэт кота `#0d0b14` с рваным контуром |

Эти же значения уже лежат в `chapters.ts` (`palette`) и в стилях текста
`GameScene.ts`, поэтому новые спрайты сядут в готовое освещение без правок.

**Что запрещено в промптах и в результатах:** текст и буквы на картинке,
водяные знаки, размытие, сглаживание, градиенты, 3D-рендер, фотореализм,
«милота» в духе стикеров (глаза-блюдца, розовые щёки) — тон игры тихий и
взрослый.

## 3. Технические требования к каждому файлу

Чтобы ассет вставлялся без переделки кода, он обязан совпадать с тем, что
код ожидает сейчас; где размер меняется — указано, какую строку править.

- PNG-32 с прозрачным фоном. Спрайт-лист — кадры в одну строку слева
  направо, без отступов и полей, все кадры одного размера. Персонажи смотрят
  **вправо** (`flipX` делает код).
- Никакого сглаживания: при увеличении в 4× видны отдельные квадраты. Если
  модель не умеет честный пиксель-арт — генерировать в 4× (например,
  192×192 на кадр) и уменьшать до цели методом «ближайший сосед», затем
  свести палитру до ≤ 32 цветов (`pngquant --nofs 32`, потом `oxipng -o4`).
- Вес: К8 — сейчас 2,15 МБ gzip одним куском; каждый новый лист ≤ 60 КБ,
  весь набор волны 1 — не тяжелее того, что заменяет. Все ассеты инлайнятся
  в бандл (`assetsInlineLimit`), пока не сделан пункт 3.1 плана.
- Проверка перед сдачей: `npm run build --prefix game`, потом скриншоты на
  1280×720 и 800×360 (тач) — кот и враги читаются, ничего не «плывёт».
- Куда класть: `game/src/assets/<имя>.png`. Совпало имя и размер кадра —
  код не трогаем. Иначе правятся три реестра: `scenes/BootScene.ts`
  (`CAT_SHEETS`), `sprites-heavy.ts` (`HEAVY_SHEETS`), `props.ts`
  (`ENEMY_SHEETS`, `PROP_IMAGES`, `LEDGE`).

## 4. Список ассетов и промпты

Промпты на английском — модели понимают его точнее. Каждый промпт начинается
с одного и того же блока стиля; он же — первый ассет, эталон.

**Общий блок стиля (вставлять в начало каждого промпта):**

```
16-bit pixel art sprite for a 2D platformer, 1-pixel dark outline (not pure
black), no anti-aliasing, no gradients, flat shading with at most two dither
tones, single light source top-left, limited palette (max 32 colors), moody
dusk mood, clean readable silhouette, transparent background, no text, no
watermark, side view.
```

**Негативный блок (если модель принимает negative prompt):**

```
blurry, anti-aliased, smooth shading, gradient, 3D render, photo, realistic,
text, letters, watermark, logo, cute sticker style, chibi, big sparkly eyes,
frame border, background scenery
```

### Э0 · Эталон стиля — делать первым, утверждать с владельцем

**Э0.1 Лист-эталон.** Один холст 512×256: кот Мистер (стоит, бежит, лежит
свернувшись), тревога, раздражение, телефон, торшер, скамья-карниз, кусок
асфальта с бордюром. Цель — не в игру, а как референс для всех следующих
генераций (image-to-image / reference). Пока эталон не утверждён, остальное
не генерировать.

```
[общий блок стиля]. Style sheet on one canvas: a small black cat with yellow
eyes (48 px tall) standing, running and curled asleep; a dark shadowy ball
of anxiety with two amber eyes; a flame-shaped irritation creature with an
angry face; a glowing phone-creature with tiny legs; a warm floor lamp with
a lit lampshade; a stone window ledge with a railing; a strip of night
asphalt with a curb and a patch of grass. Palette: night violet #2c2348,
#5e4878, warm lamp #ffd080, cat fur #1a1a22 with #4a4a5c highlight, cat eyes
#ffcc33, teal accent #88ffcc. Everything on transparent background, items
spaced apart, consistent pixel size across all items.
```

### Волна 1 · То, что в кадре всегда

**A1 · Кот Мистер — базовый лист** (замена `cat_idle.png` 576×48 / 12
кадров и `cat_run.png` 288×48 / 6 кадров; размеры сохранить — код не
меняется).

```
[общий блок стиля]. Sprite sheet of a small black house cat named Mister,
dark charcoal fur #1a1a22 with subtle #2b2b36 shading and a #4a4a5c rim
highlight, bright yellow eyes #ffcc33, small pink nose, thin tail. Frame size
exactly 48x48 px, frames in one horizontal row, no gaps. Sheet 1: 12-frame
idle loop — sitting upright, breathing, ear twitch, tail flick, one blink.
Sheet 2: 6-frame run cycle, all four paws readable, tail streaming behind.
Cat faces right. Slightly tired, cautious posture — not cute, not heroic.
```

**A2 · Кот — три копинга** (замена `cat_dash` 1614×269, `cat_play`
1542×257, `cat_sleep` 1140×190 — сейчас 6 кадров каждая и уменьшение кодом).
Новый размер кадра **96×96**, 6 кадров, лист 576×96. Правки кода:
`sprites-heavy.ts` — `fw: 96, fh: 96` у трёх записей; `GameScene.ts`
строки с `playSprite`/`sleepSprite`/`lungeSprite` — `setScale(1)` вместо
0.24/0.3/0.26 (кот в позе станет 96 px в кадре: ровно в два раза больше
базового 48 — так поза читается как «крупный план», а не как другой кот).

```
[общий блок стиля]. Same black cat Mister as in the reference sheet, frame
size exactly 96x96 px, 6 frames in one row, facing right.
Sheet "lunge" (FIGHT): wind-up crouch, ears back, then a fast claw swipe
forward with a short motion streak, then recoil — the swipe should look
tiring, not triumphant.
Sheet "appease" (FAWN): the cat drops on its side and rolls belly-up,
paws soft, eyes half-closed, a small forced-friendly expression — giving in.
Sheet "freeze" (FREEZE): the cat curls into a tight ball, tail over nose,
ears flattened, then a slow breathing loop; the world should feel far away.
```

**A3 · Пол и земля** (замена процедурных текстур `plat`, `ground`,
`plat_room`, `ground_room` в `BootScene.tex`). Три темы, каждая — бесшовный
тайл **48×16** (левый край, середина, правый край по 16 px) плюс тайл
«толщи» 16×16 под ним. Правка кода: `BootScene.create` — `this.tex(...)`
заменить на загруженные текстуры; `GameScene` рисует пол через `tileSprite`.

```
[общий блок стиля]. Seamless ground tile strip 48x16 px (left edge, middle,
right edge, each 16 px) plus a 16x16 fill tile below.
Theme "street": night asphalt #2a2440 with a pale curb line, a few cracks,
a strip of dusty grass #35422e on top.
Theme "room": warm wooden floorboards #9a6e54 / #e8cda0 with a dark
baseboard line, tiny nail dots.
Theme "road": packed dirt path #4a3a3a with pebbles, roadside grass and
dry weeds, hint of dawn light on the top edge #ffe6b0.
```

**A4 · Карнизы-платформы** (замена `ledge_street/room/stage/glass.png`,
сейчас 230–303×28, `NineSlice` с колпаками 30–34 px). Новый размер **96×32**:
колпак 32 + середина 32 + колпак 32; правка кода — `props.ts` `LEDGE`
`cap: 32` у всех четырёх. Главное требование — видно, **на чём держится**.

```
[общий блок стиля]. Platform ledge sprite 96x32 px, designed for 9-slice
stretching: left cap 32 px, repeatable middle 32 px, right cap 32 px.
"street": stone window ledge with a short iron railing and a bracket
underneath, night violet stone. "room": wooden wall shelf on two brackets,
warm wood, a book or a cup on the cap. "stage": rough plank scaffold with
rope ends. "glass": frosted glass shelf with a thin metal rail, cold
#8ad8ff light on the edge. Tops must be flat and walkable.
```

**A5 · Улица гл. 1 — фон в три слоя** (замена `buildStreet`: прямоугольники
домов и окна из кода). Три бесшовных по горизонтали картинки, кладутся
`tileSprite` со `scrollFactor` 0.15 / 0.4 / 0.75. Правка кода — `decor.ts`
`buildStreet` (около 30 строк).

- `bg_street_far.png` — **480×220**: небо не рисовать (оно остаётся
  градиентом палитры), только силуэты крыш, антенн, водонапорной башни.
- `bg_street_mid.png` — **640×260**: фасады 2–3-этажных домов с окнами,
  часть окон тёплые, часть тёмные, балконы, водосток, вывеска без букв.
- `bg_street_near.png` — **320×120**: то, что на уровне игрока за платформами:
  ограда, мусорный бак, афишная тумба без текста, куст.

```
[общий блок стиля]. Seamless horizontally tileable background layer for a
night city street, dusk violet palette #2c2348 / #5e4878 with warm window
lights #ffd080. Layer "far", 480x220: only rooftop silhouettes, antennas,
a water tower, no sky fill. Layer "mid", 640x260: two- and three-story
apartment facades, some windows lit, balconies, drainpipes, a blank shop
sign. Layer "near", 320x120: a low iron fence, a trash bin, a poster column
without letters, a shrub. Transparent where there is no object.
```

### Волна 2 · Комната, дорога, кабинет

**B1 · Комната гл. 2 — стена и окно** (замена пустоты за реквизитом).
`bg_room_wall.png` — бесшовный тайл **128×270**: обои с тихим узором,
плинтус, розетка, край ковра; окно — отдельный спрайт **180×230** с ночью
и луной (сейчас `windowFrame` рисует прямоугольник из кода).

```
[общий блок стиля]. Seamless tile 128x270 of a dim apartment wall at night:
muted wallpaper #342b3e with a faint repeating pattern, a wooden baseboard,
one power socket, the edge of a worn rug at the bottom. Second image:
window sprite 180x230, wooden frame, night sky with a small moon and two
stars, thin curtain on one side, cold #8ad8ff light on the sill.
```

**B2 · Реквизит комнаты — перерисовать в пиксель** (замена `prop_couch`,
`prop_tv`, `prop_lamp`, `prop_bed`, `prop_desk`, `prop_bookshelf`,
`prop_plant`, `prop_alarm`, `prop_door`, `prop_streetlamp`). Размер источника
не важен — `placeProp` масштабирует по высоте, поэтому генерировать сразу в
масштабе игры: диван **128×64**, телевизор **72×56**, торшер **40×112**,
кровать **144×64**, стол **112×64**, шкаф **64×112**, растение **48×64**,
будильник **48×48** (4 кадра дрожания, лист 192×48), дверь терапевта
**80×128**, уличный фонарь **32×112** (с тёплым ореолом внутри спрайта).

```
[общий блок стиля]. Set of room props for a warm evening apartment, wood
#9a6e54, fabric #b0563a, lamp light #ffd080 baked into the sprite as a soft
2-tone halo. Each on its own transparent canvas at the given size: a worn
two-seat sofa 128x64; an old CRT TV 72x56 with a faintly glowing screen; a
floor lamp 40x112 lit; a single bed 144x64 with a crumpled blanket; a desk
112x64 with a closed laptop; a bookshelf 64x112 half empty; a potted plant
48x64; an alarm clock 48x48 in 4 frames ringing (bells shaking, two motion
lines); a plain apartment door 80x128 with a small brass plate without
text; a street lamp 32x112 with a lit head and a warm halo.
```

**B3 · Дорога гл. 3 — фон** (замена `buildRoad`: кругов-деревьев и
силуэтов из кода). `bg_road_far.png` **480×200** — далёкий город, редеющий
вправо (см. комментарий в `buildRoad`: «уходим из него»); `bg_road_mid.png`
**640×240** — деревья с настоящими кронами, поле, столбы; рассветная полоса
остаётся градиентом кода. Указатели — спрайт **64×48** без букв (текст
кладёт код).

```
[общий блок стиля]. Seamless tileable layers for a road out of the city at
dawn, palette #3a3458 / #6a5a82 with a warm #ffe6b0 glow near the horizon.
Layer "far" 480x200: distant city silhouettes getting sparser to the right,
then open hills. Layer "mid" 640x240: roadside trees with proper leafy
crowns #3f5036 / #35422e, a wooden fence, telegraph poles with wires, tall
dry grass. Plus a wooden signpost sprite 64x48 with a blank arrow board.
```

**B4 · Кабинет гл. 4 — единый фон и терапевт.** Одна картинка
`bg_cabinet.png` **960×300** (не тайл): книжные полки, кресло, торшер,
растение, ковёр, окно с вечером — тёплая комната, где ничего не нужно
бить. Реквизит из B2 можно не дублировать: фон рисуется целиком.
Терапевт — **не тинт кота**. Вариант по умолчанию (пока владелец не решил
вопрос 5): старший кот другой окраски — серо-дымчатый с белой грудкой, в
очках, с пледом на коленях; **48×48**, лист «idle» 8 кадров (дыхание, кивок)
и лист «говорит» 4 кадра (лёгкое движение головы). Тот же вид существа
сохраняет мир игры и при этом читается как «другой, спокойный».

```
[общий блок стиля]. Background 960x300 of a therapist's office in the
evening: bookshelves, an armchair, a lit floor lamp, a potted plant, a rug,
a window with dusk outside, warm palette #342b3e / #5a4a52 / #ffd080; calm,
uncluttered, nothing threatening. Separate sprite sheets 48x48 of an older
smoky-grey cat with a white chest and round glasses, a plaid blanket over
its lap, sitting in the armchair: 8-frame idle (breathing, slow nod) and
4-frame talking (small head movement, no mouth exaggeration).
```

### Волна 3 · Враги, стоп-кадры, интерфейс

**C1 · Враги — единый набор с состояниями.** Сейчас у каждого 3–4 кадра
одного состояния и произвольные размеры (тревога 124×64, прокрастинация
110×56, телефон 79×60, раздражение 59×60, дела 86×96, самоутешитель 42×78,
торговец 106×98, кривое зеркало 107×156). Привести к сетке: каждый враг —
лист **64×64** (мелкие) или **96×96** (крупные: дела, торговец, зеркало),
12 кадров в ряд: 4 idle · 2 «получил удар» · 2 «затих/успокоен» · 4
«атакует». Правка кода: `props.ts` `ENEMY_SHEETS` (`fw/fh/frames`) и
`ensureEnemyAnims` (диапазоны кадров) — это уже Этап 1 плана, где враги
получают поведение (1.1), делать вместе.

```
[общий блок стиля]. Enemy sprite sheets for a game about anxiety, each
64x64 px per frame, 12 frames in one row: 4 idle, 2 hit, 2 calmed, 4
attacking. Facing right.
"Anxiety": a restless ball of dark tangled thread #3a3550 with two amber
eyes #ffd86a, frays and splits when hit, tightens into a knot when calmed.
"Procrastination": a slow heavy smoke blob #6a6a80 with half-closed eyes,
yawns, spreads flatter when calmed.
"Phone": a small phone-shaped creature #2a2f44 with a glowing screen
#8ad8ff and stubby legs, buzzes and flashes when attacking, screen dims
when calmed.
"Irritation": a compact flame #ff5a2a / #ffb040 with a scowling face,
flares when attacking, shrinks to an ember when calmed.
"Inner critic": the same silhouette as the cat Mister but pure shadow
#0d0b14 with a ragged, flickering outline and no eyes — it must read as
the cat's own shadow.
```

**C2 · Стоп-кадры знакомства — портрет и рамка.** Портрет каждого врага
**96×96** (крупный план, тот же стиль) и рамка-девятислайс **48×48** в тон
главы. Требует правки `storyFrame` (добавить картинку слева от текста) —
Этап 1, вместе с C1.

**C3 · Интерфейс.**
- Сердца: **16×14**, три состояния (полное, пустое, «без урона» — с мягким
  свечением), лист 48×14.
- ✦ воспоминание: оставить 4 кадра 30×30 (`spr_memory`), перерисовать в
  стиле — тёплая искра, не звезда из клип-арта.
- Кнопки тача (`index.html`, `#tbtn-*`): фон **64×64** в двух состояниях
  (обычная, нажата), пиктограммы «бей / избегай / уступи» **32×32** — сейчас
  это подписи текстом.
- Кнопка меню и кнопка «НАЧАТЬ»: девятислайс **32×32** с рамкой в стиле
  карнизов, два состояния.
- Заголовок игры на стартовом экране — **не генерировать до ответа на
  вопрос 4 плана (имя игры)**; пока — шрифтом.

```
[общий блок стиля]. UI set: a heart icon 16x14 in three states (full red
#ff7799, empty outline, glowing gold #ffd86a) as a 48x14 sheet; a warm
spark collectible 30x30 in 4 twinkle frames; a rounded touch button base
64x64 in normal and pressed states, dark violet #2c2348 with a #88ffcc rim;
three 32x32 pictograms: a claw swipe, a dash streak, a lowered head. No
letters anywhere.
```

**C4 · Стартовый экран и экран «сил не осталось».** Фон старта **960×540**
(не тайл): крыша ночного города, кот сидит спиной у края, внизу огни —
место, откуда начинается бег. Экран смерти остаётся чёрным по замыслу, но
получает один элемент: кот, свернувшийся в углу, **64×64**, 6 кадров
медленного дыхания — чтобы «вставай» относилось к кому-то живому.

```
[общий блок стиля]. Full-screen background 960x540: a night rooftop
overlooking a city, the small black cat sitting near the edge with its back
to the viewer, distant warm windows #ffd080 below, violet sky #2c2348 →
#5e4878 with a few stars; a lot of empty calm space in the upper half for a
title. Separate sheet 64x64, 6 frames: the same cat curled up in a corner,
slow breathing, eyes closed.
```

## 5. Порядок работ и проверка

1. **Э0 эталон → утверждение владельцем.** Без него дальше не идти.
2. **Волна 1** (A1–A5): кот, копинги, пол, карнизы, улица. После неё
   скриншоты гл. 1 на 1280×720 и 800×360 и сравнение «до/после» рядом.
   Критерий: в кадре один стиль, кот читается на высоте 360 px, вес бандла
   не вырос.
3. **Волна 2** (B1–B4): комната, реквизит, дорога, кабинет и терапевт.
   Критерий: гл. 4 визуально отличается от гл. 1–3 — тепло и покой без
   слов.
4. **Волна 3** (C1–C4) — вместе с Этапом 1 плана (враги с поведением,
   стоп-кадры с портретом): рисовать состояния до того, как код научится их
   показывать, — бессмысленно.
5. После каждой волны — `npm run build --prefix game`, скриншоты, размер
   `dist/`; правило К8: не тяжелее, чем было.

Как снимать скриншоты для сравнения: `npx vite preview --prefix game` (порт
из `vite.config.ts`, база `/game/`), в браузере `#chapter1…4`, `#tutorial`;
на 800×360 с эмуляцией касания. В репозитории игра вне гейтов, поэтому
«до/после» — ручная проверка глазами, приложить к PR.

## 6. Следующие шаги вне арта (замечено при съёмке)

- **Два стоп-кадра могут наложиться** (диагноз, п. 10): `storyFrame` не
  проверяет, открыт ли уже кадр. Защита — очередь или отказ второго кадра,
  пока первый не закрыт. Мелко, но при новых портретах станет заметно.
- Хеш `#intro` не открывает пролог (только `#tutorial`, `#game`,
  `#chapterN`) — для съёмки пролога и его правок нужен ещё один вход в
  `BootScene`.
