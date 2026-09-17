import { describe, it, expect, vi } from 'vitest';
import {
  buildModeChainSuggestion,
  resolveModeChainCandidates,
  modeChainVm,
} from './modeChain';

const tyTr = (ty: string, _vy: string) => ty;
const vyTr = (_ty: string, vy: string) => vy;

describe('buildModeChainSuggestion', () => {
  it('детская боль (hurt) предлагает разобрать Критика', () => {
    const s = buildModeChainSuggestion('vulnerable_child', tyTr);
    expect(s).not.toBeNull();
    expect(s!.candidateIds).toEqual([
      'demanding_critic',
      'punitive_critic',
      'guilt_critic',
    ]);
  });

  it('детская злость (anger) тоже предлагает разобрать Критика', () => {
    const s = buildModeChainSuggestion('angry_child', tyTr);
    expect(s!.candidateIds).toEqual([
      'demanding_critic',
      'punitive_critic',
      'guilt_critic',
    ]);
  });

  it('копинг-избегание (avoid) предлагает разобрать защищаемого Ребёнка', () => {
    const s = buildModeChainSuggestion('detached_protector', tyTr);
    expect(s!.candidateIds).toEqual([
      'vulnerable_child',
      'angry_child',
      'lonely_child',
    ]);
  });

  it('копинг-сдача (surrender) — та же тройка кандидатов', () => {
    const s = buildModeChainSuggestion('compliant_surrenderer', tyTr);
    expect(s!.candidateIds).toEqual([
      'vulnerable_child',
      'angry_child',
      'lonely_child',
    ]);
  });

  it('копинг-контроль (control) — та же тройка кандидатов', () => {
    const s = buildModeChainSuggestion('overcontroller', tyTr);
    expect(s!.candidateIds).toEqual([
      'vulnerable_child',
      'angry_child',
      'lonely_child',
    ]);
  });

  it('гиперкомпенсация (grandiose) — та же тройка кандидатов', () => {
    const s = buildModeChainSuggestion('self_aggrandiser', tyTr);
    expect(s!.candidateIds).toEqual([
      'vulnerable_child',
      'angry_child',
      'lonely_child',
    ]);
  });

  it('критик предлагает разобрать, что почувствовал Ребёнок', () => {
    const s = buildModeChainSuggestion('punitive_critic', tyTr);
    expect(s!.candidateIds).toEqual([
      'vulnerable_child',
      'humiliated_child',
      'angry_child',
    ]);
  });

  it('здоровый режим (ok) — цепочку не предлагаем', () => {
    expect(buildModeChainSuggestion('healthy_adult', tyTr)).toBeNull();
    expect(buildModeChainSuggestion('happy_child', tyTr)).toBeNull();
    expect(buildModeChainSuggestion('good_parent', tyTr)).toBeNull();
  });

  it('неизвестный modeId — null, а не падение', () => {
    expect(buildModeChainSuggestion('nonexistent', tyTr)).toBeNull();
    expect(buildModeChainSuggestion('', tyTr)).toBeNull();
  });

  it('ты/вы различаются там, где есть обращение (вопрос)', () => {
    for (const modeId of [
      'vulnerable_child', // hurt
      'detached_protector', // coping
      'punitive_critic', // critic
    ]) {
      const ty = buildModeChainSuggestion(modeId, tyTr)!;
      const vy = buildModeChainSuggestion(modeId, vyTr)!;
      expect(ty.question).not.toEqual(vy.question);
    }
  });

  it('hint — одна нейтральная строка, одинакова в обеих формах (нет обращения)', () => {
    const ty = buildModeChainSuggestion('vulnerable_child', tyTr)!;
    const vy = buildModeChainSuggestion('vulnerable_child', vyTr)!;
    expect(ty.hint).toEqual(vy.hint);
    expect(ty.hint.length).toBeGreaterThan(0);
  });
});

describe('resolveModeChainCandidates', () => {
  const modes: Record<string, { name: string }> = {
    a: { name: 'Режим А' },
    b: { name: 'Режим Б' },
  };
  const getModeById = (id: string) => modes[id];

  it('маппит id в { id, mode } в исходном порядке', () => {
    const result = resolveModeChainCandidates(['a', 'b'], getModeById);
    expect(result).toEqual([
      { id: 'a', mode: { name: 'Режим А' } },
      { id: 'b', mode: { name: 'Режим Б' } },
    ]);
  });

  it('отфильтровывает id без реального режима', () => {
    const result = resolveModeChainCandidates(
      ['a', 'nonexistent', 'b'],
      getModeById,
    );
    expect(result.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('пустой список id → пустой результат, без падения', () => {
    expect(resolveModeChainCandidates([], getModeById)).toEqual([]);
  });

  it('вызывает getModeById по каждому id ровно один раз', () => {
    const spy = vi.fn(getModeById);
    resolveModeChainCandidates(['a', 'b'], spy);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('modeChainVm', () => {
  const modes: Record<string, { name: string }> = {
    demanding_critic: { name: 'Требовательный критик' },
    punitive_critic: { name: 'Карающий критик' },
    // guilt_critic намеренно отсутствует — проверяем фильтр несуществующих id.
  };
  const getModeById = (id: string) => modes[id];

  it('режим из семьи детской боли — вопрос, подсказка и резолвнутые кандидаты одним вызовом', () => {
    const vm = modeChainVm('vulnerable_child', tyTr, getModeById);
    expect(vm).not.toBeNull();
    expect(vm!.question).toContain('Критика');
    expect(vm!.hint.length).toBeGreaterThan(0);
    expect(vm!.candidates).toEqual([
      { id: 'demanding_critic', mode: { name: 'Требовательный критик' } },
      { id: 'punitive_critic', mode: { name: 'Карающий критик' } },
    ]);
  });

  it('здоровый режим (семья ok) — null без похода в getModeById', () => {
    const spy = vi.fn(getModeById);
    expect(modeChainVm('healthy_adult', tyTr, spy)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('неизвестный modeId — null, а не падение', () => {
    expect(modeChainVm('nonexistent', tyTr, getModeById)).toBeNull();
  });
});
