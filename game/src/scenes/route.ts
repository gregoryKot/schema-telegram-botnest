// Хеш адреса — вход в сцену напрямую (смок e2e-browser/game-smoke.spec.ts).
// По умолчанию — «Неделя»; хеши старой игры живут до её удаления (#1382).
export interface SceneRoute { key: string; data?: { chapter: string } }

export function sceneForHash(raw: string): SceneRoute {
  const hash = raw.replace(/^#/, '').toLowerCase();
  if (hash === 'game' || hash.startsWith('chapter'))
    return { key: 'Game', data: { chapter: hash.startsWith('chapter') ? hash : 'chapter1' } };
  if (hash === 'tutorial') return { key: 'Tutorial' };
  if (hash === 'intro') return { key: 'Intro' };
  return { key: 'Week' };
}
