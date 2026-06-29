import Phaser from 'phaser';
import { audio } from './audio';
import { getAssist, setAssist } from './assist';
import { t, lang, setLang } from './i18n';

interface LevelEntry { scene: string; chapter?: string; label: string; enabled: boolean; }

// Player-facing chapters. Internally everything is the one `Game` scene + a chapter config.
const LEVELS: LevelEntry[] = [
  { scene: 'Start',                       label: t('Главное меню', 'Main menu'),               enabled: true  },
  { scene: 'Tutorial',                    label: t('Пролог · Знакомство', 'Prologue · Intro'), enabled: true  },
  { scene: 'Game', chapter: 'chapter1',   label: t('Глава 1 · Обычный день', 'Ch. 1 · Ordinary Day'), enabled: true  },
  { scene: 'Game', chapter: 'chapter2',   label: t('Глава 2 · Дома', 'Ch. 2 · Home'),          enabled: true  },
  { scene: 'Game', chapter: 'chapter3',   label: t('Глава 3 · Само пройдёт', 'Ch. 3 · It\'ll Pass'), enabled: true  },
  { scene: 'Game', chapter: 'chapter4',   label: t('Глава 4 · Выбор · скоро', 'Ch. 4 · Choice · soon'), enabled: false },
];

// Перевод статичных подписей меню + переключатель языка (reload пересобирает тексты)
function localizeMenu() {
  const set = (id: string, ru: string, en: string) => { const el = document.getElementById(id); if (el) el.textContent = t(ru, en); };
  set('menu-title', 'М Е Н Ю', 'M E N U');
  set('lbl-lang', 'Язык', 'Language');
  set('lbl-music', 'Музыка', 'Music');
  set('lbl-sfx', 'Звуки', 'Sound');
  set('menu-sec-help', 'П О М О Щ Ь', 'A S S I S T');
  set('lbl-lives', 'Больше жизней', 'Extra lives');
  set('lbl-invuln', 'Не умирать', 'Invincible');
  set('menu-sec-levels', 'Г Л А В Ы', 'C H A P T E R S');
  set('menu-sec-support', 'П О Д Д Е Р Ж А Т Ь', 'S U P P O R T');
  set('menu-donate', 'Поддержать проект 💛', 'Support the project 💛');
  set('menu-close', 'ЗАКРЫТЬ', 'CLOSE');
  const langBtn = document.getElementById('menu-lang');
  if (langBtn) {
    langBtn.textContent = lang === 'en' ? 'EN' : 'РУ';
    langBtn.onclick = () => { setLang(lang === 'en' ? 'ru' : 'en'); window.location.reload(); };
  }
}

const RUNNING = 5, PAUSED = 6, SLEEPING = 7;

export function setupMenu(game: Phaser.Game) {
  const btn      = document.getElementById('menu-btn')!;
  const overlay  = document.getElementById('menu-overlay')!;
  const musicBtn = document.getElementById('menu-music')!;
  const sfxBtn   = document.getElementById('menu-sfx')!;
  const closeBtn = document.getElementById('menu-close')!;
  const levelsEl = document.getElementById('menu-levels')!;
  const livesBtn = document.getElementById('menu-lives')!;
  const invulnBtn = document.getElementById('menu-invuln')!;

  let pausedKeys: string[] = [];
  localizeMenu();
  const ON = t('ВКЛ', 'ON'), OFF = t('ВЫКЛ', 'OFF');

  const syncToggles = () => {
    const m = audio.isMusicEnabled(), s = audio.isSfxEnabled();
    musicBtn.textContent = m ? ON : OFF; musicBtn.classList.toggle('off', !m);
    sfxBtn.textContent   = s ? ON : OFF; sfxBtn.classList.toggle('off', !s);
    const a = getAssist();
    livesBtn.textContent  = a.extraLives ? ON : OFF; livesBtn.classList.toggle('off', !a.extraLives);
    invulnBtn.textContent = a.invuln ? ON : OFF; invulnBtn.classList.toggle('off', !a.invuln);
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
  document.getElementById('menu-donate')?.addEventListener('click', () => {
    window.location.href = 'https://schemehappens.ru/donate';
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); overlay.classList.contains('visible') ? close() : open(); }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  musicBtn.addEventListener('click', () => { audio.setMusicEnabled(!audio.isMusicEnabled()); syncToggles(); });
  sfxBtn.addEventListener('click',   () => { audio.setSfxEnabled(!audio.isSfxEnabled()); syncToggles(); });
  livesBtn.addEventListener('click',  () => { setAssist('lives', !getAssist().extraLives); syncToggles(); });
  invulnBtn.addEventListener('click', () => { setAssist('invuln', !getAssist().invuln); syncToggles(); });

  for (const lv of LEVELS) {
    const b = document.createElement('button');
    b.className = 'menu-level';
    b.textContent = lv.label;
    b.disabled = !lv.enabled;
    if (lv.enabled) b.addEventListener('click', () => goto(lv.scene, lv.chapter));
    levelsEl.appendChild(b);
  }
}
