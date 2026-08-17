// Правило №4 CLAUDE.md: сверка MODE_CARDS (портреты режимов, shared/src/mode/
// modeCards/, контракт параллельной задачи) с реестром MODE_GROUPS вебаппа.
// MODE_GROUPS сам теперь ре-экспорт единственного источника
// (shared/src/schemaTherapy/, правило №3) — но MODE_CARDS остаётся отдельным
// реестром, поэтому копия того же теста в мини-аппе не лишняя.
import { describe, it, expect } from 'vitest';
import { MODE_CARDS } from '../../../../shared/src/mode/modeCards';
import { MODE_GROUPS } from '../../schemaTherapyData';

const REGISTRY_IDS = MODE_GROUPS.flatMap((g) => g.items.map((m) => m.id));

describe('MODE_CARDS ↔ MODE_GROUPS (webapp, правило №4)', () => {
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
