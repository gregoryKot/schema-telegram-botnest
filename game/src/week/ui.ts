// Набор интерфейса «Недели»: плашки, пузыри и кнопки рисуются пикселями в палитре арта (game/art/week_tone.py).
// Размытия и полупрозрачных подложек нет — контур, заливка и тень-ступенька, как у спрайтов.
import Phaser from 'phaser';
import { W } from '../constants';

export const FONT = '"Handjet", "Avenir Next Condensed", "Arial Narrow", sans-serif'; // запас узкий: раскладка — под Handjet
/** Кадр телефона — 640 в ширину; на большом холсте всё крупнее в то же число раз. */
export const K = W / 640;
export const px = (n: number) => Math.round(n * K);
const U = px(2); // «пиксель» интерфейса — как пиксель арта на экране

export const C = {
  ink: 0x231a36, paper: 0xfff6e6, acid: 0xff3ea5, deep: 0x17103a, night: 0x2b2060, indigo: 0x3b2d80,
  lilac: 0x6753b8, haze: 0xb8a6ff, sun: 0xf0a830,
};
export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export interface Skin { fill: number; shade: number; line: number; text: number }
export const SKIN = {
  paper: { fill: C.paper, shade: 0xd9c9b0, line: C.ink, text: C.ink },
  acid: { fill: C.acid, shade: 0xc21f78, line: C.ink, text: 0xffffff },
  night: { fill: C.night, shade: C.deep, line: C.lilac, text: C.paper },
  sun: { fill: C.sun, shade: 0xc27a1c, line: C.ink, text: C.ink },
  ghost: { fill: C.deep, shade: C.deep, line: C.indigo, text: C.haze },
} satisfies Record<string, Skin>;

export type Tail = 'none' | 'say' | 'think';
type G = Phaser.GameObjects.Graphics;

/** Плашка со ступенчатыми углами: контур, заливка, полоска тени по низу. */
export function plate(g: G, x: number, y: number, w: number, h: number, s: Skin) {
  g.fillStyle(s.line).fillRect(x + U, y, w - 2 * U, h).fillRect(x, y + U, w, h - 2 * U);
  g.fillStyle(s.fill).fillRect(x + 2 * U, y + U, w - 4 * U, h - 2 * U).fillRect(x + U, y + 2 * U, w - 2 * U, h - 4 * U);
  g.fillStyle(s.shade).fillRect(x + 2 * U, y + h - 2 * U, w - 4 * U, U);
}

/** Хвостик под плашкой: клин реплики или два квадрата мысли; (tx, y) — середина нижней кромки. */
function tail(g: G, kind: Tail, tx: number, y: number, s: Skin) {
  if (kind === 'say') {
    for (let i = 0; i < 3; i++) g.fillStyle(s.line).fillRect(tx - (3 - i) * U, y + i * U, (3 - i) * 2 * U, U);
    g.fillStyle(s.fill).fillRect(tx - 2 * U, y - U, 4 * U, 2 * U).fillRect(tx - U, y + U, 2 * U, U);
  } else if (kind === 'think') {
    g.fillStyle(s.line).fillRect(tx - 2 * U, y + U, 4 * U, 4 * U).fillRect(tx - 4 * U, y + 6 * U, 3 * U, 3 * U);
    g.fillStyle(s.fill).fillRect(tx - U, y + 2 * U, 2 * U, 2 * U).fillRect(tx - 3 * U, y + 7 * U, U, U);
  }
}
const TAIL_H: Record<Tail, number> = { none: 0, say: 3 * U, think: 9 * U };

export interface LabelOpts { size?: number; bold?: boolean; maxW?: number; padX?: number; padY?: number; tail?: Tail; dot?: number }
export interface Label { box: Phaser.GameObjects.Container; w: number; h: number }

/** Подпись на плашке. Начало координат — кончик хвостика (низ по центру): так пузырь ставят над головой. */
export function label(scene: Phaser.Scene, text: string, skin: Skin, o: LabelOpts = {}): Label {
  const padX = px(o.padX ?? 10), padY = px(o.padY ?? 6), kind = o.tail ?? 'none', dot = o.dot === undefined ? 0 : 5 * U;
  const tx = scene.add.text(0, 0, text, {
    fontFamily: FONT, fontSize: `${px(o.size ?? 17)}px`, fontStyle: o.bold ? '700' : '500', color: hex(skin.text),
    align: 'center', wordWrap: o.maxW ? { width: px(o.maxW) } : undefined, lineSpacing: px(1),
  }).setOrigin(0.5, 0);
  const w = Math.ceil((tx.width + dot) / 2) * 2 + 2 * padX, h = Math.ceil(tx.height / 2) * 2 + 2 * padY, top = -h - TAIL_H[kind];
  const g = scene.add.graphics();
  plate(g, -w / 2, top, w, h, skin);
  tail(g, kind, 0, -TAIL_H[kind], skin);
  if (o.dot !== undefined) g.fillStyle(o.dot).fillRect(-w / 2 + padX, top + h / 2 - 2 * U, 3 * U, 3 * U); // непрочитанное сообщение
  tx.setPosition(dot / 2, top + padY - U / 2);
  return { box: scene.add.container(0, 0, [g, tx]), w, h: h + TAIL_H[kind] };
}

/** Кнопка: плашка с подписью, зона нажатия во всю плашку; нажатие проседает на пиксель. */
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, skin: Skin,
  onTap?: () => void, size = 17): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  plate(g, -w / 2, -h / 2, w, h, skin);
  const tx = scene.add.text(0, -U / 2, text, { fontFamily: FONT, fontSize: `${px(size)}px`, fontStyle: '700', color: hex(skin.text) }).setOrigin(0.5);
  const box = scene.add.container(x, y, [g, tx]);
  if (!onTap) return box;
  box.setSize(w, h).setInteractive({ useHandCursor: true });
  box.on('pointerdown', () => { box.y = y + U; onTap(); });
  box.on('pointerup', () => { box.y = y; });
  box.on('pointerout', () => { box.y = y; });
  return box;
}
