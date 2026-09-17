/**
 * Санитизация meta событий разбора случая.
 *
 * Этот модуль стоит между свободным текстом человека и таблицей аналитики.
 * В разборе он пишет сцену («сообщение прочитано час назад, ответа нет»),
 * своё слово в теле и порыве и имя, которым он назвал часть, — всё это
 * PII-чувствительно и в аналитику попасть не должно ни при каких входных
 * данных (правило №7 CLAUDE.md).
 *
 * Поэтому тест проверяет не только «известное поле проходит», но и главное:
 * ЛЮБОЕ лишнее поле отбрасывается, а негодное значение обнуляет мету целиком
 * (всё-или-ничего), а не пролезает частично.
 */
import { sanitizeCaseMeta } from './analytics-meta.sanitize-case';
import type { AnalyticsEventName } from '../analytics/analytics.constants';

const call = (name: string, meta: Record<string, unknown>) =>
  sanitizeCaseMeta(name as AnalyticsEventName, meta);

describe('sanitizeCaseMeta', () => {
  describe('case_scene', () => {
    it('пропускает только известные источники сцены', () => {
      expect(call('case_scene', { source: 'own' })).toEqual({ source: 'own' });
      expect(call('case_scene', { source: 'frame' })).toEqual({
        source: 'frame',
      });
    });

    it('незнакомый источник обнуляет мету', () => {
      expect(call('case_scene', { source: 'придуманное' })).toBeUndefined();
      expect(call('case_scene', { source: 42 })).toBeUndefined();
      expect(call('case_scene', {})).toBeUndefined();
    });

    it('текст сцены не проходит даже рядом с валидным полем', () => {
      const out = call('case_scene', {
        source: 'own',
        scene: 'сообщение прочитано час назад, ответа нет',
      });
      expect(out).toEqual({ source: 'own' });
      expect(JSON.stringify(out)).not.toContain('сообщение');
    });
  });

  describe('case_criterion', () => {
    it('пропускает три известных вердикта', () => {
      for (const verdict of ['mode', 'ordinary', 'borderline']) {
        expect(call('case_criterion', { verdict })).toEqual({ verdict });
      }
    });

    it('чужой вердикт не проходит', () => {
      expect(call('case_criterion', { verdict: 'maybe' })).toBeUndefined();
      expect(call('case_criterion', { verdict: true })).toBeUndefined();
    });
  });

  describe('case_recognized', () => {
    it('пропускает modeId и флаг согласия', () => {
      expect(
        call('case_recognized', { modeId: 'detached_protector', agreed: true }),
      ).toEqual({ modeId: 'detached_protector', agreed: true });
      expect(
        call('case_recognized', { modeId: 'angry_child', agreed: false }),
      ).toEqual({ modeId: 'angry_child', agreed: false });
    });

    it('имя части, которое человек придумал сам, в аналитику не уходит', () => {
      // Алиас — свободный текст и шифруется в БД; в события идёт только
      // технический modeId.
      const out = call('case_recognized', {
        modeId: 'detached_protector',
        agreed: true,
        alias: 'Стена',
      });
      expect(out).toEqual({ modeId: 'detached_protector', agreed: true });
    });

    it('modeId не в формате идентификатора отбрасывается целиком', () => {
      expect(
        call('case_recognized', { modeId: 'Стена', agreed: true }),
      ).toBeUndefined();
      expect(
        call('case_recognized', { modeId: 'a'.repeat(65), agreed: true }),
      ).toBeUndefined();
      expect(
        call('case_recognized', { modeId: 'detached protector', agreed: true }),
      ).toBeUndefined();
    });

    it('без булева согласия мета не сохраняется', () => {
      expect(
        call('case_recognized', { modeId: 'angry_child', agreed: 'да' }),
      ).toBeUndefined();
      expect(
        call('case_recognized', { modeId: 'angry_child' }),
      ).toBeUndefined();
    });
  });

  describe('mode_renamed', () => {
    it('пропускает три известных источника имени', () => {
      for (const source of ['chip', 'own', 'skipped']) {
        expect(call('mode_renamed', { source })).toEqual({ source });
      }
    });

    it('само имя не проходит', () => {
      const out = call('mode_renamed', { source: 'own', alias: 'Гонщик' });
      expect(out).toEqual({ source: 'own' });
    });

    it('чужой источник обнуляет мету', () => {
      expect(call('mode_renamed', { source: 'auto' })).toBeUndefined();
    });
  });

  describe('case_finished', () => {
    it('пропускает только modeId', () => {
      expect(
        call('case_finished', { modeId: 'punitive_critic', extra: 'что-то' }),
      ).toEqual({ modeId: 'punitive_critic' });
    });

    it('битый modeId отбрасывается', () => {
      expect(call('case_finished', { modeId: '' })).toBeUndefined();
      expect(call('case_finished', { modeId: 123 })).toBeUndefined();
    });
  });

  it('case_started меты не имеет — всё присланное отбрасывается', () => {
    expect(call('case_started', { scene: 'что-то личное' })).toBeUndefined();
  });

  it('незнакомое имя события меты не получает', () => {
    expect(call('case_unknown_event', { source: 'own' })).toBeUndefined();
  });
});
