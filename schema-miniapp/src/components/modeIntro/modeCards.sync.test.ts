// Правило №4 CLAUDE.md: два реестра, обязанные совпадать, держит тест-сверка,
// падающая при рассинхроне. MODE_CARDS (портреты режимов, shared/src/mode/
// modeCards/, контракт параллельной задачи) обязан покрывать каждый modeId
// из MODE_GROUPS мини-аппа — иначе у части режимов не будет портрета и
// экран «Знакомство с режимом» тихо откатится к пустой форме без объяснения.
// Отдельный тест — в webapp (тот же реестр MODE_CARDS, но своя копия
// schemaTherapyData.ts, они могут разъехаться).
import { describe, it, expect } from 'vitest';
import { MODE_CARDS } from '../../../../shared/src/mode/modeCards';
import { MODE_GROUPS } from '../../schemaTherapyData';

const REGISTRY_IDS = MODE_GROUPS.flatMap((g) => g.items.map((m) => m.id));

describe('MODE_CARDS ↔ MODE_GROUPS (мини-апп, правило №4)', () => {
  it('у каждого режима из MODE_GROUPS есть карточка в MODE_CARDS', () => {
    for (const id of REGISTRY_IDS) {
      expect(MODE_CARDS[id], `нет карточки для режима "${id}"`).toBeTruthy();
    }
  });

  it('в MODE_CARDS нет карточек для несуществующих modeId', () => {
    const registrySet = new Set(REGISTRY_IDS);
    for (const id of Object.keys(MODE_CARDS)) {
      expect(registrySet.has(id), `карточка "${id}" не ссылается на реальный режим`).toBe(true);
    }
  });
});
