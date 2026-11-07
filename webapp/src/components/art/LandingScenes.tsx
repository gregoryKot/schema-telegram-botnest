// Сцены «Как это работает» и режимов — крупные картинки лендинга из элементов языка
// знаков (docs/design/PAPER_2026-11.md: полоска — потребность, слои — схема, лента —
// момент, который закрутился, круги — режимы, лист — рост, камешки — наблюдения).
//  • SceneChildhood — пять полосок колесом вокруг маленькой полоски-ребёнка; верхней
//    не хватило: она бледная и короткая, а поверх неё легли слои — схема.
//  • SceneTrigger — лента закручивается вокруг полоски: схема срабатывает раньше мысли.
//  • SceneNotice — согнутая полоска (как было) бледная, рядом та же стоит прямо, у
//    основания прорастает лист; камешки на земле — наблюдения, которые к этому привели.
//  • SceneTogether — режимы: большой круг мха (Здоровый Взрослый) рядом с маленьким
//    кругом глины (Ребёнок) на одной земле; Критик и копинг — поодаль, мельче и бледнее.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

/** Четыре полоски, которым хватило: колесом от 72° (верхней, бледной, не хватило). */
const SPOKES = [
  { fill: INK.moss, tilt: 3 },
  { fill: INK.amber, tilt: -3 },
  { fill: INK.teal, tilt: 4 },
  { fill: INK.slate, tilt: -2 },
];

export function SceneChildhood() {
  return (
    <SceneSvg hue={45} patch={70} patchAt="tr" blob="a">
      <rect x="147" y="66" width="26" height="34" rx="13" fill={INK.plum} fillOpacity=".4" />
      <Lift>
        {SPOKES.map((s, i) => (
          <rect key={i} x="147" y="24" width="26" height="76" rx="13" fill={s.fill} transform={`rotate(${(i + 1) * 72 + s.tilt} 160 138)`} />
        ))}
        <rect x="126" y="50" width="68" height="13" rx="6.5" fill={INK.sage} />
        <rect x="134" y="33" width="52" height="13" rx="6.5" fill={INK.moss} />
        <rect x="142" y="16" width="36" height="13" rx="6.5" fill={INK.clay} />
        <rect x="151" y="120" width="18" height="36" rx="9" fill={INK.clay} />
      </Lift>
    </SceneSvg>
  );
}

// Спираль ленты вокруг полоски (x = 160): изнанка целиком — за полоской, лицевые
// витки — поверх. Точки посчитаны заранее (винтовая линия, 2.45 витка).
const RIBBON_BACK =
  'M115 197 C114 198 107 199 106 200 C105 202 107 203 110 204 C113 205 119 206 126 207 C132 207 141 207 150 206 C158 205 168 204 176 202 C184 200 193 197 199 194 C205 191 210 187 212 183 C214 179 215 175 213 171 C211 167 206 163 201 160 C195 157 187 154 179 152 C171 150 161 148 153 147 C145 146 135 146 128 146 C121 146 115 147 111 148 C108 149 106 151 106 152 C106 153 109 155 114 155 C118 156 125 157 132 157 C140 157 149 157 158 155 C166 154 176 152 184 150 C191 147 199 144 204 141 C209 138 212 133 214 130 C215 126 213 122 210 118 C207 114 202 111 195 108 C189 105 180 102 172 100 C163 98 153 97 145 97 C137 96 128 96 122 97 C116 97 111 98 108 99 C106 100 105 102 107 103';
const RIBBON_FRONT = [
  'M26 226 C52 230 86 218 106 202 C107 202 109 205 114 206 C119 207 127 207 135 207 C143 207 154 206 163 205 C173 203 183 201 190 198 C198 195 205 191 209 187 C213 184 213 178 214 177',
  'M106 153 C107 154 109 156 114 157 C119 158 127 159 135 159 C143 159 154 158 163 157 C172 155 182 153 190 150 C198 147 205 143 209 139 C213 136 213 130 214 129',
  'M106 105 C107 106 110 108 115 109 C120 110 128 111 136 111 C144 111 155 110 164 108 C173 107 187 103 193 101 C222 92 246 72 252 54 C258 36 240 26 228 36 C216 46 232 62 252 60 C272 58 288 44 296 30',
];

export function SceneTrigger() {
  const ribbon = { fill: 'none', strokeWidth: 14, strokeLinecap: 'round' } as const;
  return (
    <SceneSvg hue={25} patch={70} patchAt="bl" blob="b">
      <Lift>
        <rect x="58" y="216" width="204" height="14" rx="7" fill={INK.sage} />
        <path d={RIBBON_BACK} stroke={INK.clayDeep} {...ribbon} />
        <rect x="146" y="44" width="28" height="176" rx="14" fill={INK.moss} />
        {RIBBON_FRONT.map((d) => <path key={d} d={d} stroke={INK.clay} {...ribbon} />)}
      </Lift>
    </SceneSvg>
  );
}

export function SceneNotice() {
  return (
    <SceneSvg hue={135} patch={70} patchAt="tr" blob="c">
      <path d="M112 210 C112 174 98 148 62 124" fill="none" stroke={INK.slate} strokeOpacity=".3" strokeWidth="26" strokeLinecap="round" />
      <Lift>
        <path d="M30 218 H290" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <rect x="146" y="62" width="28" height="152" rx="14" fill={INK.moss} />
        <path d="M218 214 C218 188 224 168 238 154" fill="none" stroke={INK.moss} strokeWidth="6" strokeLinecap="round" />
        <path d="M238 154 C232 122 256 100 292 100 C294 134 270 156 238 154 Z" fill={INK.moss} />
        <path d="M220 190 C232 174 254 172 268 180 C256 198 234 202 220 190 Z" fill={INK.sage} />
        <ellipse cx="42" cy="204" rx="15" ry="9" transform="rotate(-14 42 204)" fill={INK.amber} />
        <ellipse cx="72" cy="207" rx="12" ry="8" transform="rotate(-14 72 207)" fill={INK.clay} />
        <ellipse cx="96" cy="209" rx="9" ry="6" transform="rotate(-14 96 209)" fill={INK.slate} />
      </Lift>
    </SceneSvg>
  );
}

export function SceneTogether({ hue = 45 }: { hue?: number }) {
  return (
    <SceneSvg hue={hue} blob="b">
      <circle cx="262" cy="70" r="24" fill={INK.plum} fillOpacity=".5" />
      <circle cx="62" cy="64" r="18" fill={INK.slate} fillOpacity=".45" />
      <Lift>
        <path d="M24 220 H296" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <circle cx="132" cy="150" r="66" fill={INK.moss} />
        <circle cx="224" cy="194" r="23" fill={INK.clay} />
        <path d="M268 218 C262 194 272 174 294 168 C298 192 290 210 268 218 Z" fill={INK.moss} />
      </Lift>
    </SceneSvg>
  );
}
