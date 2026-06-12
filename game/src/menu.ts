import Phaser from 'phaser';
import { audio } from './audio';

interface LevelEntry { scene: string; chapter?: string; label: string; enabled: boolean; }

// Player-facing chapters. Internally everything is the one `Game` scene + a chapter config.
const LEVELS: LevelEntry[] = [
  { scene: 'Start',                       label: 'Главное меню',             enabled: true  },
  { scene: 'Tutorial',                    label: 'Пролог · Знакомство',      enabled: true  },
  { scene: 'Game', chapter: 'chapter1',   label: 'Глава 1 · Обычный день',   enabled: true  },
  { scene: 'Game', chapter: 'chapter2',   label: 'Глава 2 · Дома',           enabled: true  },
  { scene: 'Game', chapter: 'chapter3',   label: 'Глава 3 · Стыд · скоро',   enabled: false },
  { scene: 'Game', chapter: 'chapter4',   label: 'Глава 4 · Зависть · скоро', enabled: false },
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
  const goto = (scene: string, chapter?: string) => {
    overlay.classList.remove('visible');
    pausedKeys = [];
    game.scene.scenes.forEach(s => {
      const st = s.sys.settings.status;
      if (st === RUNNING || st === PAUSED || st === SLEEPING) game.scene.stop(s.scene.key);
    });
    audio.ensure();
    game.scene.start(scene, chapter ? { chapter } : undefined);
  };

  btn.addEventListener('click', () => overlay.classList.contains('visible') ? close() : open());
  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); overlay.classList.contains('visible') ? close() : open(); }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  musicBtn.addEventListener('click', () => { audio.setMusicEnabled(!audio.isMusicEnabled()); syncToggles(); });
  sfxBtn.addEventListener('click',   () => { audio.setSfxEnabled(!audio.isSfxEnabled()); syncToggles(); });

  for (const lv of LEVELS) {
    const b = document.createElement('button');
    b.className = 'menu-level';
    b.textContent = lv.label;
    b.disabled = !lv.enabled;
    if (lv.enabled) b.addEventListener('click', () => goto(lv.scene, lv.chapter));
    levelsEl.appendChild(b);
  }
}
