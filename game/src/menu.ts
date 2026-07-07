import Phaser from 'phaser';
import { audio } from './audio';
import { getAssist, setAssist } from './assist';
import { t, lang, setLang, type MsgKey } from './i18n';

interface LevelEntry { scene: string; chapter?: string; label: string; enabled: boolean; }

// Player-facing chapters. Internally everything is the one `Game` scene + a chapter config.
const LEVELS: LevelEntry[] = [
  { scene: 'Start',                       label: t('m_main_menu'),               enabled: true  },
  { scene: 'Tutorial',                    label: t('m_prologue_intro'), enabled: true  },
  { scene: 'Game', chapter: 'chapter1',   label: t('m_ch_1_ordinary_day'), enabled: true  },
  { scene: 'Game', chapter: 'chapter2',   label: t('m_ch_2_home'),          enabled: true  },
  { scene: 'Game', chapter: 'chapter3',   label: t('m_ch_3_it_ll_pass'), enabled: true  },
  { scene: 'Game', chapter: 'chapter4',   label: t('m_ch_4_choice_soon'), enabled: false },
];

// Перевод статичных подписей меню + переключатель языка (reload пересобирает тексты)
function localizeMenu() {
  const set = (id: string, key: MsgKey) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
  set('menu-title', 'm_m_e_n_u');
  set('lbl-lang', 'm_language');
  set('lbl-music', 'm_music');
  set('lbl-sfx', 'm_sound');
  set('menu-sec-help', 'm_a_s_s_i_s_t');
  set('lbl-lives', 'm_extra_lives');
  set('lbl-invuln', 'm_invincible');
  set('menu-sec-levels', 'm_c_h_a_p_t_e');
  set('menu-sec-support', 'm_s_u_p_p_o_r');
  set('menu-donate', 'm_support_the_project');
  set('menu-close', 'm_close');
  set('tbtn-hit', 'm_fight');
  set('tbtn-avoid', 'm_avoid');
  set('tbtn-fawn', 'm_surrender');
  document.getElementById('menu-btn')?.setAttribute('aria-label', t('m_menu'));
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
  const ON = t('m_on'), OFF = t('m_off');

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
