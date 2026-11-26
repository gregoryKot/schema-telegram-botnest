// Каждая статья вкладки «Запросы» приходит со своим знаком из GUIDE_SIGNS: без него в списке пустое место.
import { describe, expect, it } from 'vitest';
import { buildConcernGuides } from '../../../../shared/src/schemaTherapy/guide';
import { GUIDE_SIGNS } from '../../components/art/guideSignsModel';
import { CONCERN_SIGN, concernGuideLook } from './guideReferenceConcerns';

describe('знаки статей «Запросов»', () => {
  const ids = buildConcernGuides((t) => t).map((c) => c.id);

  it('у каждой статьи есть знак из реестра', () => {
    for (const id of ids) expect(GUIDE_SIGNS, id).toContain(concernGuideLook(id).sign);
  });

  it('в таблице знаков нет ключей без статьи', () => {
    expect(Object.keys(CONCERN_SIGN).filter((id) => !ids.includes(id))).toEqual([]);
  });
});
