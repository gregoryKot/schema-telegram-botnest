// Хеш адреса — вход в сцену напрямую (смок e2e-browser/game-smoke.spec.ts).
// `week` — новая игра «Неделя»: пока скрыта за хешем, по умолчанию идёт старая.
export interface SceneRoute { key: string; data?: { chapter: string } }

export function sceneForHash(raw: string): SceneRoute {
  const hash = raw.replace(/^#/, '').toLowerCase();
  if (hash === 'game' || hash.startsWith('chapter'))
    return { key: 'Game', data: { chapter: hash.startsWith('chapter') ? hash : 'chapter1' } };
  if (hash === 'tutorial') return { key: 'Tutorial' };
  if (hash === 'intro') return { key: 'Intro' };
  if (hash === 'week') return { key: 'Week' };
  return { key: 'Start' };
}
