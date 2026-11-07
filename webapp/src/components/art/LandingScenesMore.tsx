// Сцены возможностей, финала и мини-тестов (вторая половина LandingScenes.tsx):
//  • SceneCheckIn — пять полосок разной высоты на белом листе сегодняшнего дня,
//    позади листы прошлых дней: из ежедневных отметок складывается картина.
//  • SceneDiary — листы веером, на верхнем камешки: каждый день мысль кладут на
//    место, и через пару недель паттерн виден (финальный призыв «просто заметить»).
//  • SceneQuiz — колода карточек-вопросов, на верхней варианты-полоски, один
//    выбран; рядом камешек — маленькое наблюдение о себе, которое уносят с собой.
import { INK } from './scenePaper';
import { Lift, SceneSvg, type BlobShape } from './sceneKit';

const BARS = [
  { h: 100, fill: INK.moss },
  { h: 124, fill: INK.amber },
  { h: 70, fill: INK.clay },
  { h: 112, fill: INK.slate },
  { h: 88, fill: INK.plum },
];

export function SceneCheckIn({ hue = 135, blob = null }: { hue?: number; blob?: BlobShape | null }) {
  return (
    <SceneSvg hue={hue} blob={blob}>
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

export function SceneDiary({ hue = 70 }: { hue?: number }) {
  return (
    <SceneSvg hue={hue} patch={135} patchAt="bl" blob="c">
      <Lift>
        <rect x="58" y="64" width="124" height="150" rx="14" transform="rotate(-13 120 139)" fill={INK.sage} />
        <rect x="104" y="50" width="124" height="156" rx="14" transform="rotate(-3 166 128)" fill={INK.roseSoft} />
        <rect x="150" y="58" width="124" height="156" rx="14" transform="rotate(8 212 136)" fill={INK.sheet} />
        <ellipse cx="196" cy="118" rx="22" ry="14" transform="rotate(-16 196 118)" fill={INK.moss} />
        <ellipse cx="232" cy="150" rx="18" ry="12" transform="rotate(-16 232 150)" fill={INK.clay} />
        <ellipse cx="200" cy="178" rx="15" ry="10" transform="rotate(-16 200 178)" fill={INK.slate} />
        <ellipse cx="286" cy="62" rx="12" ry="8" transform="rotate(-16 286 62)" fill={INK.amber} />
      </Lift>
    </SceneSvg>
  );
}

export function SceneQuiz({ hue = 300 }: { hue?: number }) {
  const pill = { x: 118, width: 124, height: 18, rx: 9 } as const;
  return (
    <SceneSvg hue={hue} patch={70} patchAt="bl" blob="a">
      <Lift>
        <rect x="66" y="74" width="152" height="124" rx="16" transform="rotate(-11 142 136)" fill={INK.slateSoft} />
        <rect x="82" y="64" width="158" height="128" rx="16" transform="rotate(-4 161 128)" fill={INK.amberSoft} />
        <g transform="rotate(4 180 124)">
          <rect x="100" y="58" width="160" height="134" rx="16" fill={INK.sheet} />
          <rect y="80" {...pill} fill={INK.sage} fillOpacity=".55" />
          <rect y="110" {...pill} fill={INK.amber} />
          <rect y="140" {...pill} fill={INK.sage} fillOpacity=".55" />
          <rect y="170" {...pill} width="70" fill={INK.sage} fillOpacity=".55" />
        </g>
        <ellipse cx="236" cy="222" rx="28" ry="17" transform="rotate(-16 236 222)" fill={INK.clay} />
      </Lift>
    </SceneSvg>
  );
}
