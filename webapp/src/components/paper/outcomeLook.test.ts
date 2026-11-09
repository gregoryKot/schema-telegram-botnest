// Литеральная таблица исходов главного потока совпадает с OUTCOME_LOOK (правило №4): одна сверка на всех
// её потребителей — PaperOutcome, исходы приглашения (entryLook), «Готово» карточки дня (sidebarDay).
import { describe, it, expect } from 'vitest';
import { OUTCOME_LOOK } from '../../../../shared/src/theme/entityLook';
import { OUTCOME_LOOK_LIT } from './outcomeLook';

describe('OUTCOME_LOOK_LIT', () => {
  it('совпадает с OUTCOME_LOOK: те же исходы, бумага и знак', () => {
    expect(OUTCOME_LOOK_LIT).toEqual(OUTCOME_LOOK);
  });
});
