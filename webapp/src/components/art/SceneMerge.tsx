// SceneMerge — герой /link и /account/merge (docs/design/PAPER_2026-11.md, «Сцены»): слева и справа
// по вееру листов-записей двух входов, их нижние листы уже сошлись посередине в одну стопку на земле,
// верхний лист стопки исписан. Записи двух входов собираются в одном месте. Данных в сцене нет:
// сколько переедет, говорит список под ней. Лист неба (граница и доступ, 240). Свой чанк: страницы
// берут сцену через React.lazy с зарезервированным местом (MergeSpread).
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

/** Веер: листы на общей опоре внизу, наклоны — к середине холста; верхний лист белый, исписан. */
const FAN = [-30, -16, -3] as const;
const FAN_FILL = [INK.tealSoft, INK.amberSoft, INK.sheet] as const;

function Fan({ x, side }: { x: number; side: 1 | -1 }) {
  return (
    <g data-fan={side === -1 ? 'left' : 'right'}>
      {FAN.map((deg, i) => (
        <g key={deg} transform={`rotate(${deg * side} ${x} 176)`}>
          <rect x={x - 30} y={86} width="60" height="78" rx="9" fill={FAN_FILL[i]} />
          {i === FAN.length - 1 && [100, 114].map((y, k) => (
            <rect key={y} x={x - 18} y={y} width={k ? 22 : 36} height="6" rx="3" fill={INK.brown} fillOpacity=".28" />
          ))}
        </g>
      ))}
    </g>
  );
}

/** Стопка посередине: снизу вверх чередует сдвиг и наклон; верхний — белый, исписан. */
const STACK = [
  { dx: -4, y: 182, deg: -3, fill: INK.amberSoft },
  { dx: 6, y: 170, deg: 2.5, fill: INK.tealSoft },
  { dx: 0, y: 158, deg: -1.5, fill: INK.sheet },
] as const;

export default function SceneMerge({ hue = 240 }: { hue?: number }) {
  return (
    <SceneSvg hue={hue} patch={135} patchAt="tr" sheet="c">
      <Lift>
        <path d="M46 222 H274" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <Fan x={78} side={-1} />
        <Fan x={242} side={1} />
        {STACK.map((s, k) => (
          <g key={s.y} data-stack={k} transform={`rotate(${s.deg} 160 ${s.y + 20})`}>
            <rect x={110 + s.dx} y={s.y} width="100" height="40" rx="9" fill={s.fill} />
            {k === STACK.length - 1 && [10, 22].map((dy, i) => (
              <rect key={dy} x={124 + s.dx} y={s.y + dy} width={i ? 44 : 72} height="6" rx="3" fill={INK.brown} fillOpacity=".28" />
            ))}
          </g>
        ))}
      </Lift>
    </SceneSvg>
  );
}
