// Сюжетные триггеры по ходу главы: спавн врагов, реплики, гейты, стоп-кадры знакомства.
import { GROUND_Y } from '../../constants';
import { audio } from '../../audio';
import { MobCtx, Procrastination, PhoneMob, Irritation } from '../../enemies/home';
import { SelfSoothe, CrookedMirror, Bargainer } from '../../enemies/road';
import type { GameScene } from '../GameScene';
import { introOnce } from './frames';
import { beginOverwhelm } from './ending';
import { spawnAnx } from './anx';
import { spawnCritic } from './critic';
import { makeGate } from './gates';

// Story beats fire as you ADVANCE — running right = the day passing toward dusk
export function setupTriggers(s: GameScene) {
  s.triggers = s.chapter.triggers.map(t => ({
    x: t.x, done: false,
    fn: () => {
      const beforeA = s.anx.length, beforeH = s.homeMobs.length;
      if (t.anx) { for (let i = 0; i < t.anx; i++) spawnAnx(s, s.player.x + 360 + i * 120, 1);
        introOnce(s, 'anx', 'm_anxiety', 'm_hit_it_it_splits_avoid_it'); }
      if (t.critic) spawnCritic(s); // у критика свой стоп-кадр
      if (t.proc) { s.homeMobs.push(new Procrastination(mobCtx(s), t.proc, t.seat ? GROUND_Y - t.seat : undefined));
        introOnce(s, 'proc', 'm_procrastination', 'm_it_clings_drags_you_down_a'); }
      if (t.phone) { s.homeMobs.push(new PhoneMob(mobCtx(s), t.phone));
        introOnce(s, 'phone', 'm_the_phone', 'm_lures_you_into_comfort_steals_time'); }
      if (t.irrit) { s.homeMobs.push(new Irritation(mobCtx(s), t.irrit));
        introOnce(s, 'irrit', 'm_irritation', 'm_flares_out_of_nowhere_blow_off'); }
      // зазывалы Акта II — без интро-стоп-кадров: их дверь представится сама
      if (t.soothe) s.homeMobs.push(new SelfSoothe(mobCtx(s), t.soothe));
      if (t.mirror) s.homeMobs.push(new CrookedMirror(mobCtx(s), t.mirror));
      if (t.bargainer) s.homeMobs.push(new Bargainer(mobCtx(s), t.bargainer));
      if (t.say) { s.say(t.say, 2400); if (t.anx) audio.anx(); }
      if (t.gate) makeGate(s, t.gate, [...s.anx.slice(beforeA), ...s.homeMobs.slice(beforeH)]);
      if (t.overwhelm) beginOverwhelm(s);
    },
  }));
}
// shared context the home-chapter mobs use to read/affect the player
function mobCtx(s: GameScene): MobCtx {
  return {
    scene: s,
    player: () => s.player,
    frozen: () => s.frozen,
    dashing: () => s.dashing,
    damage: (fromX, throughFreeze) => { if (s.invuln <= 0) s.damage(fromX, throughFreeze); },
    sayOnce: (k, t, d) => s.sayOnce(k, t, d),
    burst: (x, y, c, n, sp) => s.burst(x, y, c, n, sp),
    hitstop: (ms) => s.doHitstop(ms),
    slow: (m) => { s.speedMult = Math.min(s.speedMult, m); },
  };
}

export function updateTriggers(s: GameScene) {
  // не больше одного триггера за кадр: первый ставит стоп-кадр (hitstop), и
  // следующие дождутся своего кадра — иначе два стоп-кадра наложатся
  for (const t of s.triggers) {
    if (!t.done && s.player.x > t.x) { t.done = true; t.fn(); return; }
  }
}
