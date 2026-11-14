// Гейты «не пройти, пока не разобрался» и Акт II: дверь терапевта + отговорки-заслоны.
import Phaser from 'phaser';
import { GROUND_Y } from '../../constants';
import { audio } from '../../audio';
import { Door, ExcuseVoice } from '../../doors';
import type { MsgKey } from '../../i18n';
import { track } from '../../analytics';
import type { GameScene } from '../GameScene';
import { onDoorEnter, beginFinalApproach } from './cabinet';

// Боевой гейт: стена «не пройти, пока не разобрался» — падает, когда все
// привязанные враги разрешены (убиты / успокоены / выключены).
export interface Gate {
  x: number; col: Phaser.GameObjects.Rectangle; gfx: Phaser.GameObjects.Graphics;
  mobs: { alive: boolean }[]; open: boolean; t: number;
}

// ── Акт II «Дорога»: дверь терапевта + отговорки-заслоны ────────────────────
// Отговорка = голос-пузырь + невидимый гейт. Копинги на неё не действуют —
// путь открывает только ОТВЕТ (E/тап). Ответы — голос терапевта.
export function buildDoors(s: GameScene) {
  if (!s.chapter.doors?.length) return;
  for (const cfg of s.chapter.doors)
    s.doors.push(new Door(s, cfg.kind, cfg.x, () => onDoorEnter(s), s.chapter.arenaW));
  // заслоны: (x голоса, реплики, ответ) — гейт чуть дальше голоса
  const blocks: { x: number; lines: MsgKey[]; answer: MsgKey }[] = [
    { x: 880,  lines: ['m_exc_pass', 'm_exc_later'],        answer: 'm_ans_later' },
    { x: 1720, lines: ['m_exc_expensive'],                  answer: 'm_ans_expensive' },
    { x: 2520, lines: ['m_exc_fine', 'm_exc_others_worse'], answer: 'm_ans_fine' },
    { x: 3260, lines: ['m_exc_worse'],                      answer: 'm_ans_worse' },
  ];
  for (const b of blocks) {
    const stub = { alive: true };                       // держит гейт, пока не ответил
    makeGate(s, b.x + 90, [stub]);
    s.voices.push(new ExcuseVoice(s, b.x, GROUND_Y - 150, b.lines, b.answer,
      v => { stub.alive = false; onVoiceAnswered(s, v); }));
  }
  // тач: пузырь — мелкая цель, поэтому тап В ЛЮБОМ месте рядом с голосом = ответить.
  // guard по hitstop: тап, закрывающий стоп-кадр, не должен заодно «ответить».
  s.input.on('pointerdown', () => {
    if (s.dead || s.hitstop > 0) return;
    s.voices.find(v => !v.answered && v.near(s.player.x))?.doAnswer();
  });
}

export function updateDoors(s: GameScene, dt: number) {
  if (!s.doors.length) return;
  for (const d of s.doors) d.update(dt, s.player.x);
  for (const v of s.voices) v.update(dt, s.player.x);
  // E: сначала ответить голосу рядом, иначе — войти в дверь рядом
  if (Phaser.Input.Keyboard.JustDown(s.keys.E)) {
    const v = s.voices.find(v => !v.answered && v.near(s.player.x));
    if (v) v.doAnswer();
    else s.doors.find(d => d.near(s.player.x))?.tryEnter();
  }
  // финальный подход к двери терапевта: копинги гаснут один за другим
  const th = s.doors.find(d => d.kind === 'therapist');
  if (th && !s.finalApproach && s.player.x > th.x - 420) beginFinalApproach(s);
}

function onVoiceAnswered(s: GameScene, v: ExcuseVoice) {
  track('excuse_answered', { answer: v.answer });
  audio.gate();
  s.say(v.answer, 3400);
  s.burst(s.player.x, s.player.y - 30, 0x88ffcc, 10, 130);
  if (s.hearts < s.MAX_HEARTS) { s.hearts += 1; s.updateHearts(); } // ответил себе — стало легче
}

// ── Гейты: дальше нельзя, пока не разобрался с тем, что навалилось ─────────
export function makeGate(s: GameScene, x: number, mobs: { alive: boolean }[]) {
  const col = s.add.rectangle(x, GROUND_Y / 2, 18, GROUND_Y + 40, 0, 0);
  s.physics.add.existing(col, true);
  s.physics.add.collider(s.player, col, () =>
    s.sayOnce('gate', 'm_can_t_pass_deal_with_this', 2600));
  const gfx = s.add.graphics().setDepth(5);
  s.gates.push({ x, col, gfx, mobs, open: false, t: Math.random() * 1000 });
}

export function updateGates(s: GameScene, dt: number) {
  const color = s.chapter.palette.glow2;
  for (const g of s.gates) {
    if (g.open) continue;
    g.t += dt;
    if (g.mobs.length && g.mobs.every(m => !m.alive)) { openGate(s, g); continue; }
    g.gfx.clear();
    for (let y = 26; y < GROUND_Y - 6; y += 26) {
      const a = 0.30 + 0.18 * Math.sin(g.t * 0.005 + y * 0.35);
      g.gfx.fillStyle(color, a);
      g.gfx.fillRect(g.x - 7 + Math.sin(g.t * 0.003 + y) * 3, y, 14, 18);
    }
    g.gfx.fillStyle(color, 0.12);
    g.gfx.fillEllipse(g.x, GROUND_Y - 2, 70, 12);
  }
}

function openGate(s: GameScene, g: Gate) {
  g.open = true;
  g.gfx.clear();
  g.col.destroy();
  for (let y = 60; y < GROUND_Y; y += 90) s.burst(g.x, y, s.chapter.palette.glow2, 6, 120);
  audio.gate();
  // важная правда главы: копинг = передышка, не решение — отпустило НЕНАДОЛГО
  s.say('m_it_let_go_not_for_long', 2400);
}

// тревога, отколовшаяся от «гейтовой», тоже держит стену
export function adoptIntoGate(s: GameScene, parent: object, child: object) {
  const g = s.gates.find(g => !g.open && g.mobs.includes(parent as { alive: boolean }));
  if (g) g.mobs.push(child as { alive: boolean });
}
