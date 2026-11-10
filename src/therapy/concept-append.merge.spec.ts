// Чистое объединение «дописать с холста» (#963): только добавление, без
// дублей, связи режима сохраняют свои тексты. Запись в «БД» и история —
// concept-append.spec.ts.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { mergeConceptAppend, type ConceptAppendState } from './concept-append';
import {
  APPEND_LINK_SCHEMAS_MAX,
  APPEND_MODE_LINKS_MAX,
  APPEND_SCHEMA_LINKS_MAX,
} from './concept-append-links';
import { ConceptualizationDto } from './dto/conceptualization.dto';

const empty = (): ConceptAppendState => ({
  modeIds: [],
  schemaIds: [],
  modeLinks: [],
  schemaLinks: [],
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
      ...empty(),
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
      {
        ...empty(),
        modeIds: ['x'],
        schemaIds: ['y'],
        modeLinks: [CRITIC_LINK, other],
      },
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

// Колесо потребностей на холсте: «✓» режим → потребность (modeLinks[].needIds)
// и «✗» схема → потребность (schemaLinks[].needIds). Только добавление.
const SCHEMA_LINK = {
  schemaId: 'defectiveness',
  belief: 'Со мной что-то не так',
  origin: 'Критика дома',
  needIds: ['attachment'],
  done: [{ techniqueId: 'chairwork', day: '2026-11-05' }],
};

describe('mergeConceptAppend — потребности', () => {
  it('needIds режима дописываются в существующую связь, alias/схемы/тексты остаются', () => {
    const link = { ...CRITIC_LINK, needIds: ['attachment'] };
    const patch = mergeConceptAppend(
      { ...empty(), modeIds: ['punitive_critic'], modeLinks: [link] },
      {
        modeLinks: [
          {
            modeId: 'punitive_critic',
            schemaIds: [],
            needIds: ['attachment', 'limits'],
          },
        ],
      },
    );
    expect(patch).toEqual({
      modeLinks: [{ ...link, needIds: ['attachment', 'limits'] }],
    });
  });

  it('связи режима нет — заводится связь только с потребностями', () => {
    const patch = mergeConceptAppend(empty(), {
      modeLinks: [
        { modeId: 'healthy_adult', schemaIds: [], needIds: ['play'] },
      ],
    });
    expect(patch.modeIds).toEqual(['healthy_adult']);
    expect(patch.schemaIds).toBeUndefined();
    expect(patch.modeLinks).toEqual([
      {
        modeId: 'healthy_adult',
        alias: '',
        schemaIds: [],
        needIds: ['play'],
        origin: '',
        manifest: '',
        strategy: '',
      },
    ]);
  });

  it('схемы и потребности в одной линии — одна новая связь с обоими', () => {
    const patch = mergeConceptAppend(empty(), {
      modeLinks: [{ modeId: 'm', schemaIds: ['shame'], needIds: ['autonomy'] }],
    });
    expect(patch.modeLinks).toHaveLength(1);
    expect(patch.modeLinks![0]).toMatchObject({
      schemaIds: ['shame'],
      needIds: ['autonomy'],
    });
  });

  it('schemaLinks: needIds дописываются в запись схемы, убеждение/опыт/отметки остаются', () => {
    const patch = mergeConceptAppend(
      {
        ...empty(),
        schemaIds: ['defectiveness'],
        schemaLinks: [SCHEMA_LINK],
      },
      {
        schemaLinks: [
          { schemaId: 'defectiveness', needIds: ['expression', 'attachment'] },
        ],
      },
    );
    expect(patch).toEqual({
      schemaLinks: [{ ...SCHEMA_LINK, needIds: ['attachment', 'expression'] }],
    });
  });

  it('schemaLinks: записи нет — новая в форме ConceptSchemaLink, схема — в schemaIds', () => {
    const patch = mergeConceptAppend(
      { ...empty(), schemaLinks: [SCHEMA_LINK] },
      { schemaLinks: [{ schemaId: 'abandonment', needIds: ['attachment'] }] },
    );
    expect(patch.schemaIds).toEqual(['abandonment']);
    expect(patch.schemaLinks).toEqual([
      SCHEMA_LINK,
      {
        schemaId: 'abandonment',
        belief: '',
        origin: '',
        needIds: ['attachment'],
      },
    ]);
  });

  it('неизвестные needId отброшены; только неизвестные — связь не заводится', () => {
    const patch = mergeConceptAppend(empty(), {
      modeLinks: [{ modeId: 'm', schemaIds: [], needIds: ['safety', 'play'] }],
      schemaLinks: [
        { schemaId: 's1', needIds: ['safety', 'limits', 'limits'] },
        { schemaId: 's2', needIds: ['x'] },
      ],
    });
    expect(patch.modeLinks![0].needIds).toEqual(['play']);
    expect(patch.schemaLinks).toEqual([
      { schemaId: 's1', belief: '', origin: '', needIds: ['limits'] },
    ]);
    // Схема без единой известной потребности — в общий список, без записи.
    expect(patch.schemaIds).toEqual(['s1', 's2']);
  });

  it('повторное добавление того же — патч пустой (писать нечего)', () => {
    const cur = {
      ...empty(),
      modeIds: ['punitive_critic'],
      schemaIds: ['defectiveness'],
      modeLinks: [CRITIC_LINK],
      schemaLinks: [SCHEMA_LINK],
    };
    expect(
      mergeConceptAppend(cur, {
        modeLinks: [
          { modeId: 'punitive_critic', schemaIds: [], needIds: ['safety'] },
        ],
        schemaLinks: [{ schemaId: 'defectiveness', needIds: ['attachment'] }],
      }),
    ).toEqual({});
  });

  it('предел записей схем: новая сверх потолка не заводится, существующая дописывается', async () => {
    const full = Array.from({ length: APPEND_SCHEMA_LINKS_MAX }, (_, i) => ({
      ...SCHEMA_LINK,
      schemaId: `s${i}`,
      needIds: ['attachment', 'autonomy', 'expression', 'play'],
    }));
    const patch = mergeConceptAppend(
      { ...empty(), schemaLinks: full },
      {
        schemaLinks: [
          { schemaId: 'overflow', needIds: ['play'] },
          { schemaId: 's0', needIds: ['limits', 'play'] },
        ],
      },
    );
    expect(patch.schemaLinks).toHaveLength(APPEND_SCHEMA_LINKS_MAX);
    expect(patch.schemaLinks![0].needIds).toHaveLength(5);
    expect(patch.schemaIds).toEqual(['overflow', 's0']);
    // Сверка с ConceptualizationDto (правило №4): результат проходит полное
    // сохранение полей, а на одну запись больше — уже нет.
    const ok = plainToInstance(ConceptualizationDto, {
      schemaLinks: patch.schemaLinks,
    });
    await expect(validate(ok, { whitelist: true })).resolves.toEqual([]);
    const over = plainToInstance(ConceptualizationDto, {
      schemaLinks: [...patch.schemaLinks!, { schemaId: 'extra' }],
    });
    const errs = await validate(over, { whitelist: true });
    expect(errs.map((e) => e.property)).toContain('schemaLinks');
  });
});
