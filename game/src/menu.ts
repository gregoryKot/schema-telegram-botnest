import Phaser from 'phaser';
import { audio } from './audio';

interface LevelEntry { key: string; label: string; enabled: boolean; }

// Chapters. New-direction game = Level1+. Old scenes kept as "архив".
const LEVELS: LevelEntry[] = [
  { key: 'Start',  label: 'Главное меню',                 enabled: true  },
  { key: 'Level1', label: 'Глава 1 · Обычный день',       enabled: true  },
  { key: 'Level2', label: 'Глава 2 · Дома · скоро',        enabled: false },
  { key: 'Level3', label: 'Глава 3 · Стыд · скоро',        enabled: false },
  { key: 'Level4', label: 'Глава 4 · Зависть · скоро',     enabled: false },
];

const RUNNING = 5, PAUSED = 6, SLEEPING = 7;

export function setupMenu(game: Phaser.Game) {
  const btn      = document.getElementById('menu-btn')!;
  const overlay  = document.getElementById('menu-overlay')!;
  const musicBtn = document.getElementById('menu-music')!;
  const sfxBtn   = document.getElementById('menu-sfx')!;
  const closeBtn = document.getElementById('menu-close')!;
  const levelsEl = document.getElementById('menu-levels')!;

  let pausedKeys: string[] = [];

  const syncToggles = () => {
    const m = audio.isMusicEnabled(), s = audio.isSfxEnabled();
    musicBtn.textContent = m ? 'ВКЛ' : 'ВЫКЛ'; musicBtn.classList.toggle('off', !m);
    sfxBtn.textContent   = s ? 'ВКЛ' : 'ВЫКЛ'; sfxBtn.classList.toggle('off', !s);
  };

  const open = () => {
    overlay.classList.add('visible');
    syncToggles();
    pausedKeys = [];
    for (const s of game.scene.getScenes(true)) {
      game.scene.pause(s.scene.key);
      pausedKeys.push(s.scene.key);
    }
  };
  const close = () => {
    overlay.classList.remove('visible');
    for (const k of pausedKeys) game.scene.resume(k);
    pausedKeys = [];
  };
  const goto = (key: string) => {
    overlay.classList.remove('visible');
    pausedKeys = [];
    game.scene.scenes.forEach(s => {
      const st = s.sys.settings.status;
      if (st === RUNNING || st === PAUSED || st === SLEEPING) game.scene.stop(s.scene.key);
    });
    audio.ensure();
    game.scene.start(key);
  };

  btn.addEventListener('click', () => overlay.classList.contains('visible') ? close() : open());
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  musicBtn.addEventListener('click', () => { audio.setMusicEnabled(!audio.isMusicEnabled()); syncToggles(); });
  sfxBtn.addEventListener('click',   () => { audio.setSfxEnabled(!audio.isSfxEnabled()); syncToggles(); });

  for (const lv of LEVELS) {
    const b = document.createElement('button');
    b.className = 'menu-level';
    b.textContent = lv.label;
    b.disabled = !lv.enabled;
    if (lv.enabled) b.addEventListener('click', () => goto(lv.key));
    levelsEl.appendChild(b);
  }
}
