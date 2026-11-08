// Сцены возможностей, мини-тестов и статей (вторая половина LandingScenes.tsx):
//  • SceneCheckIn — пять полосок разной высоты на белом листе сегодняшнего дня,
//    позади листы прошлых дней: из ежедневных отметок складывается картина.
//  • SceneQuiz — карточки-вопросы веером (сверху белая) на вырезанном листе оттенка
//    теста; задние карточки цветные и не в тон листу (fanFor). На верхней — строки
//    вопроса и под ними три плашки-ответа, одна выбрана (шапка /tests); с `sign` низ
//    карточки пуст: туда вступление теста кладёт знак самого теста (QuizIntro.tsx) —
//    плитка списка и вступление связаны знаком, а не только цветом.
//  • SceneHomeScreen — «Значок на экране»: телефон, на экране бледные значки других
//    приложений и крупно сам знак продукта (BrandMark — тот же, что у иконки PWA, не
//    перерисованный) со своей тенью-вырезкой.
//  • SceneCover — обложка статьи без картинки: листы веером, верхний исписан.
//    `tone` — набор по порядку карточки: число листов, сторона веера и цвета свои,
//    соседние обложки не повторяются.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';
import { BrandMark } from './BrandMark';

const BARS = [
  { h: 100, fill: INK.moss },
  { h: 124, fill: INK.amber },
  { h: 70, fill: INK.clay },
  { h: 112, fill: INK.slate },
  { h: 88, fill: INK.plum },
];

export function SceneCheckIn({ hue = 135 }: { hue?: number }) {
  return (
    <SceneSvg hue={hue} blob={null}>
      <Lift>
        <rect x="52" y="50" width="168" height="176" rx="16" transform="rotate(-10 136 138)" fill={INK.amberSoft} />
        <rect x="70" y="40" width="172" height="182" rx="16" transform="rotate(-3 156 131)" fill={INK.tealSoft} />
        <g transform="rotate(4 186 134)">
          <rect x="96" y="44" width="182" height="180" rx="18" fill={INK.sheet} />
          {BARS.map((b, i) => (
            <rect key={i} x={116 + i * 31} y={204 - b.h} width="20" height={b.h} rx="10" fill={b.fill} />
          ))}
        </g>
      </Lift>
    </SceneSvg>
  );
}

/** Веер: две карточки позади (их цвет — fanFor), верхняя — белая, с вопросом.
 *  Поворот вокруг центра карточки. */
const FAN = [{ x: 52, deg: -18 }, { x: 78, deg: -5 }] as const;
/** Цвета задних карточек по листу: небо и солома, но не в тон листу — на небесном
 *  (170–260) листе вместо неба шалфей, на соломенном (50–100) вместо соломы бирюза. */
const fanFor = (hue: number): [string, string] => [hue >= 170 && hue <= 260 ? INK.sage : INK.sky, hue >= 50 && hue <= 100 ? INK.tealSoft : INK.amberSoft];
/** Строки вопроса на верхней карточке и плашки ответов под ними (вторая — выбрана). */
const QUESTION = [{ y: 66, w: 88 }, { y: 84, w: 56 }];
const ANSWERS = [{ y: 112, fill: INK.brown, op: '.14' }, { y: 140, fill: INK.moss, op: '1' }, { y: 168, fill: INK.brown, op: '.14' }];

export function SceneQuiz({ hue = 135, sign = false }: { hue?: number; sign?: boolean }) {
  const card = { y: 40, width: 140, height: 180, rx: 18 } as const;
  const backs = fanFor(hue);
  return (
    <SceneSvg hue={hue} blob="a">
      <Lift by={6}>
        {FAN.map((c, i) => <rect key={c.x} x={c.x} {...card} fill={backs[i]} transform={`rotate(${c.deg} ${c.x + 70} 130)`} />)}
        <g transform="rotate(8 176 130)">
          <rect x="106" {...card} fill={INK.sheet} />
          {QUESTION.map((l) => (
            <rect key={l.y} x="128" y={l.y} width={l.w} height="9" rx="4.5" fill={INK.brown} fillOpacity=".3" />
          ))}
          {!sign && ANSWERS.map((a) => (
            <rect key={a.y} x="126" y={a.y} width="100" height="20" rx="10" fill={a.fill} fillOpacity={a.op} />
          ))}
        </g>
      </Lift>
    </SceneSvg>
  );
}

/** Значки других приложений на экране — бледные квадратики бумаги, сетка 3×2. */
const APPS = [INK.tealSoft, INK.amberSoft, INK.sky, INK.sage, INK.amberSoft, INK.tealSoft];
/** Знак продукта на экране: левый верхний угол и размер (скругление — как у иконки, 112/512). */
const MARK = { x: 128, y: 136, size: 64, rx: 14 } as const;

export function SceneHomeScreen({ hue = 45 }: { hue?: number }) {
  return (
    <SceneSvg hue={hue} patch={135} patchAt="bl" blob="c">
      <g transform="rotate(-5 160 130)">
        <Lift by={6}><rect x="100" y="20" width="120" height="220" rx="22" fill={INK.sheet} /></Lift>
        {APPS.map((fill, i) => (
          <rect key={i} x={118 + (i % 3) * 30} y={44 + Math.floor(i / 3) * 32} width="24" height="24" rx="7" fill={fill} />
        ))}
        <Lift by={5}><rect x={MARK.x} y={MARK.y} width={MARK.size} height={MARK.size} rx={MARK.rx} fill={INK.clay} /></Lift>
        <g transform={`translate(${MARK.x} ${MARK.y})`}><BrandMark size={MARK.size} /></g>
        <rect x="140" y="218" width="40" height="5" rx="2.5" fill={INK.brown} fillOpacity=".3" />
      </g>
    </SceneSvg>
  );
}

/** Наборы листов обложек: левые края листов (последний — верхний, исписанный), наклоны
 *  и цвета нижних. Меняется не только цвет: три листа веером вправо, два — влево,
 *  три с верхним посередине. */
const COVERS = [
  { xs: [74, 108, 142], deg: [-14, -4, 7], back: [INK.sage, INK.clay] },
  { xs: [140, 84], deg: [12, -6], back: [INK.amber] },
  { xs: [52, 160, 106], deg: [-13, 13, -2], back: [INK.plum, INK.moss] },
] as const;

export function SceneCover({ tone = 0, hue = 45 }: { tone?: number; hue?: number }) {
  const set = COVERS[((tone % COVERS.length) + COVERS.length) % COVERS.length];
  const sheet = { y: 52, width: 104, height: 140, rx: 12 } as const;
  const turn = (i: number) => `rotate(${set.deg[i]} ${set.xs[i] + 52} 122)`;
  const top = set.xs.length - 1;
  const x = set.xs[top];
  return (
    <SceneSvg hue={hue} blob={null}>
      <Lift>
        {set.back.map((fill, i) => <rect key={fill} x={set.xs[i]} {...sheet} fill={fill} transform={turn(i)} />)}
        <g transform={turn(top)}>
          <rect x={x} {...sheet} fill={INK.sheet} />
          {[76, 96, 116, 136].map((y, i) => (
            <rect key={y} x={x + 16} y={y} width={i === 3 ? 44 : 72} height="8" rx="4" fill={INK.brown} fillOpacity=".28" />
          ))}
        </g>
      </Lift>
    </SceneSvg>
  );
}
