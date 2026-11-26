// Записки «Тёплых слов» (b18): соседние — разной тёплой бумаги, знак — группы режима, которому отвечали;
// у переписанной фразы режима нет — знак заботы, а не выдуманный режим.
import { describe, it, expect } from 'vitest';
import { WARM_NOTE_HUES, warmNoteLook } from './warmWordsLook';
import { MODE_GROUP_SIGN } from '../../../../shared/src/theme/entityLook';

describe('warmNoteLook', () => {
  it('бумага — тёплые оттенки по очереди, соседи различаются', () => {
    const hues = [0, 1, 2, 3, 4].map((i) => warmNoteLook({ source: 'diary', modeId: 'vulnerable_child' }, i).hue);
    expect(hues).toEqual([...WARM_NOTE_HUES, WARM_NOTE_HUES[0], WARM_NOTE_HUES[1]]);
    hues.slice(1).forEach((h, i) => expect(h).not.toBe(hues[i]));
  });

  it('знак — группа режима: детский — ChildCare, критик — Looming', () => {
    expect(warmNoteLook({ source: 'diary', modeId: 'vulnerable_child' }, 0).sign).toBe(MODE_GROUP_SIGN.child);
    expect(warmNoteLook({ source: 'card', modeId: 'demanding_critic' }, 0).sign).toBe(MODE_GROUP_SIGN.critic);
  });

  it('переписанная фраза — знак заботы; режим вне реестра — общий знак режимов', () => {
    expect(warmNoteLook({ source: 'phrase', modeId: '' }, 0).sign).toBe(MODE_GROUP_SIGN.healthy);
    expect(warmNoteLook({ source: 'diary', modeId: 'нет-такого' }, 0).sign).toBe('cluster');
  });
});
