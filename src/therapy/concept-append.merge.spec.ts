// Чистое объединение «дописать с холста» (#963): только добавление, без
// дублей, связи режима сохраняют свои тексты. Запись в «БД» и история —
// concept-append.spec.ts.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  APPEND_LINK_SCHEMAS_MAX,
  APPEND_MODE_LINKS_MAX,
  mergeConceptAppend,
  type ConceptAppendState,
} from './concept-append';
import { ConceptualizationDto } from './dto/conceptualization.dto';

const empty = (): ConceptAppendState => ({
  modeIds: [],
  schemaIds: [],
  modeLinks: [],
});

const CRITIC_LINK = {
  modeId: 'punitive_critic',
  alias: 'Судья',
  schemaIds: ['defectiveness'],
  needIds: ['safety'],
  origin: 'Голос отца',
  manifest: 'Не отправляет резюме',
  strategy: 'Ограничить время',
};

describe('mergeConceptAppend', () => {
  it('объединяет без дублей: сначала существующие, затем новые по порядку', () => {
    const patch = mergeConceptAppend(
      { ...empty(), modeIds: ['a', 'b'], schemaIds: ['s1'] },
      { modeIds: ['b', 'c', 'c', 'd'], schemaIds: ['s1', 's2'] },
    );
    expect(patch.modeIds).toEqual(['a', 'b', 'c', 'd']);
    expect(patch.schemaIds).toEqual(['s1', 's2']);
  });

  it('поле, которого нет в теле, в патч не попадает (не трогается)', () => {
    const patch = mergeConceptAppend(
      { ...empty(), schemaIds: ['s1'], modeLinks: [CRITIC_LINK] },
      { modeIds: ['healthy_adult'] },
    );
    expect(Object.keys(patch)).toEqual(['modeIds']);
  });

  it('всё уже есть или тело пустое — патч пустой (писать нечего)', () => {
    const cur = {
      modeIds: ['punitive_critic'],
      schemaIds: ['defectiveness'],
      modeLinks: [CRITIC_LINK],
    };
    expect(mergeConceptAppend(cur, {})).toEqual({});
    expect(
      mergeConceptAppend(cur, {
        modeIds: ['punitive_critic'],
        schemaIds: ['defectiveness'],
        modeLinks: [
          { modeId: 'punitive_critic', schemaIds: ['defectiveness'] },
        ],
      }),
    ).toEqual({});
  });

  it('линия схема → режим добавляет режим и схемы в общие списки и новую связь', () => {
    const patch = mergeConceptAppend(empty(), {
      modeLinks: [{ modeId: 'vulnerable_child', schemaIds: ['abandonment'] }],
    });
    expect(patch.modeIds).toEqual(['vulnerable_child']);
    expect(patch.schemaIds).toEqual(['abandonment']);
    // Форма normalizeModeLinks/emptyModeLink: тексты пустые, не undefined.
    expect(patch.modeLinks).toEqual([
      {
        modeId: 'vulnerable_child',
        alias: '',
        schemaIds: ['abandonment'],
        needIds: [],
        origin: '',
        manifest: '',
        strategy: '',
      },
    ]);
  });

  it('существующая связь получает новые схемы, alias/needIds/тексты остаются', () => {
    const patch = mergeConceptAppend(
      { ...empty(), modeLinks: [CRITIC_LINK] },
      {
        modeLinks: [
          { modeId: 'punitive_critic', schemaIds: ['defectiveness', 'shame'] },
        ],
      },
    );
    expect(patch.modeLinks).toEqual([
      { ...CRITIC_LINK, schemaIds: ['defectiveness', 'shame'] },
    ]);
  });

  it('линия без схем связь не заводит, но режим в список попадает', () => {
    const patch = mergeConceptAppend(empty(), {
      modeLinks: [{ modeId: 'detached_protector', schemaIds: [] }],
    });
    expect(patch.modeIds).toEqual(['detached_protector']);
    expect(patch.modeLinks).toBeUndefined();
  });

  it('ничего не удаляет: прежние связи и id остаются в патче целиком', () => {
    const other = { ...CRITIC_LINK, modeId: 'demanding_critic', alias: 'Босс' };
    const patch = mergeConceptAppend(
      { modeIds: ['x'], schemaIds: ['y'], modeLinks: [CRITIC_LINK, other] },
      { modeIds: ['z'], modeLinks: [{ modeId: 'm', schemaIds: ['y'] }] },
    );
    expect(patch.modeIds).toEqual(['x', 'z', 'm']);
    expect(patch.modeLinks!.slice(0, 2)).toEqual([CRITIC_LINK, other]);
  });

  // Сверка с ConceptualizationDto (правило №4): дописанное обязано проходить
  // следующее полное сохранение полей, иначе автосохранение вкладки ловит 400.
  it('потолки связей = потолки ConceptualizationDto: результат проходит полное сохранение', async () => {
    const full = Array.from({ length: APPEND_MODE_LINKS_MAX }, (_, i) => ({
      ...CRITIC_LINK,
      modeId: `m${i}`,
      schemaIds: Array.from(
        { length: APPEND_LINK_SCHEMAS_MAX - 1 },
        (_, j) => `s${j}`,
      ),
    }));
    const patch = mergeConceptAppend(
      { ...empty(), modeLinks: full },
      {
        modeLinks: [
          { modeId: 'm0', schemaIds: ['n1', 'n2', 'n3'] },
          { modeId: 'overflow', schemaIds: ['s1'] },
        ],
      },
    );
    expect(patch.modeLinks).toHaveLength(APPEND_MODE_LINKS_MAX);
    expect(patch.modeLinks![0].schemaIds).toHaveLength(APPEND_LINK_SCHEMAS_MAX);
    expect(patch.modeIds).toContain('overflow');
    const dto = plainToInstance(ConceptualizationDto, {
      modeLinks: patch.modeLinks,
    });
    await expect(validate(dto, { whitelist: true })).resolves.toEqual([]);
    // Контрольный образец: на одну связь больше — полное сохранение отказало бы.
    const over = plainToInstance(ConceptualizationDto, {
      modeLinks: [...patch.modeLinks!, { modeId: 'extra' }],
    });
    const errs = await validate(over, { whitelist: true });
    expect(errs.map((e) => e.property)).toContain('modeLinks');
  });
});
