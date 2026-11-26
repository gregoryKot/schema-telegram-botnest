// DTO «сохранить колесо потребностей» (правило №6) и сверка с контрактом
// фронта (правило №4): поля ConceptNeedLink, периоды и шкала в
// shared/src/therapy/conceptGraph/needLinks.ts = DTO и нормализатор бэкенда.
// Бэкенд shared не импортирует — контракт читается из файла (образец —
// concept-append.dto.spec.ts). Там же: полное сохранение концептуализации
// поле needLinks не принимает — колесо пишет только своя ручка.
import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import {
  CONCEPT_NEED_NOTE_MAX,
  ConceptNeedLinkDto,
  ConceptNeedNotesDto,
  ConceptNeedRatingsDto,
  ConceptNeedsDto,
} from './concept-needs.dto';
import { ConceptSaveDto } from './concept-save.dto';
import { NEED_IDS } from '../../bot/bot.service';
import { BODY_LIMIT_BYTES } from '../../infra/body-limit';
import { MODE_MAP_NODE_TEXT_MAX } from '../../utils/text-limits';
import { NEED_PERIODS, NEED_RATING_MAX } from '../concept-need-links';

async function check(body: Record<string, unknown>) {
  const dto = plainToInstance(ConceptNeedsDto, body);
  const errs = await validate(dto, { whitelist: true });
  return { dto, props: errs.map((e) => e.property) };
}
const one = (link: Record<string, unknown>) => check({ needLinks: [link] });
const BAD = { props: ['needLinks'] };
const OK = { props: [] };

function dtoProps(cls: new () => object): string[] {
  const metas = getMetadataStorage().getTargetValidationMetadatas(
    cls,
    '',
    true,
    false,
  );
  return [...new Set(metas.map((m) => m.propertyName))].sort();
}

describe('ConceptNeedsDto', () => {
  it('полное колесо из пяти потребностей проходит', async () => {
    const needLinks = NEED_IDS.map((needId) => ({
      needId,
      ratings: { child: 0, teen: 5, now: 10 },
      notes: { child: 'детство', teen: 'подростком', now: 'сейчас' },
    }));
    await expect(check({ needLinks })).resolves.toMatchObject(OK);
  });

  it('пустое колесо и запись без оценок и заметок проходят', async () => {
    await expect(check({ needLinks: [] })).resolves.toMatchObject(OK);
    await expect(one({ needId: 'play' })).resolves.toMatchObject(OK);
    await expect(
      one({ needId: 'play', ratings: {}, notes: {} }),
    ).resolves.toMatchObject(OK);
  });

  it('тело без needLinks или не массив — отказ', async () => {
    await expect(check({})).resolves.toMatchObject(BAD);
    await expect(check({ needLinks: 'x' })).resolves.toMatchObject(BAD);
    await expect(check({ needLinks: [null] })).resolves.toMatchObject(BAD);
  });

  it('оценка 11, −1, дробная и строкой — отказ; 0 и 10 проходят', async () => {
    for (const v of [NEED_RATING_MAX + 1, -1, 7.5, '7'])
      for (const p of NEED_PERIODS)
        await expect(
          one({ needId: 'play', ratings: { [p]: v } }),
        ).resolves.toMatchObject(BAD);
    await expect(
      one({ needId: 'play', ratings: { child: 0, now: NEED_RATING_MAX } }),
    ).resolves.toMatchObject(OK);
  });

  it('неизвестная потребность и запись без needId — отказ', async () => {
    await expect(one({ needId: 'safety' })).resolves.toMatchObject(BAD);
    await expect(one({ ratings: { now: 5 } })).resolves.toMatchObject(BAD);
    await expect(one({ needId: 42 })).resolves.toMatchObject(BAD);
  });

  it('заметка длиннее предела и не строкой — отказ; ровно предел проходит', async () => {
    for (const p of NEED_PERIODS) {
      await expect(
        one({
          needId: 'play',
          notes: { [p]: 'ж'.repeat(CONCEPT_NEED_NOTE_MAX + 1) },
        }),
      ).resolves.toMatchObject(BAD);
      await expect(
        one({ needId: 'play', notes: { [p]: 42 } }),
      ).resolves.toMatchObject(BAD);
    }
    await expect(
      one({
        needId: 'play',
        notes: { now: 'ж'.repeat(CONCEPT_NEED_NOTE_MAX) },
      }),
    ).resolves.toMatchObject(OK);
  });

  it('шесть записей — отказ (потребностей пять)', async () => {
    const six = [...NEED_IDS, NEED_IDS[0]].map((needId) => ({ needId }));
    await expect(check({ needLinks: six })).resolves.toMatchObject(BAD);
  });

  it('ratings и notes — только объекты', async () => {
    for (const v of ['x', 5, [{ now: 5 }]]) {
      await expect(one({ needId: 'play', ratings: v })).resolves.toMatchObject(
        BAD,
      );
      await expect(one({ needId: 'play', notes: v })).resolves.toMatchObject(
        BAD,
      );
    }
  });

  it('лишнее режется: поля тела, записи и вложенных объектов', async () => {
    const { dto, props } = await check({
      goals: 'остальные поля эта ручка не пишет',
      needLinks: [
        {
          needId: 'play',
          belief: 'лишнее',
          ratings: { now: 5, adult: 9 },
          notes: { now: 'заметка', secret: 'лишнее' },
        },
      ],
    });
    expect(props).toEqual([]);
    expect(dto).not.toHaveProperty('goals');
    expect(JSON.parse(JSON.stringify(dto))).toEqual({
      needLinks: [
        { needId: 'play', ratings: { now: 5 }, notes: { now: 'заметка' } },
      ],
    });
  });

  // Поле заметки стоит в панели холста (maxLength MODE_MAP_NODE_TEXT_MAX), и
  // заметки карт #1065 переезжают в колесо как есть: предел меньше дал бы 400
  // на всё колесо из-за одной старой заметки.
  it('предел заметки — предел текста узла карты, а не короче', () => {
    expect(CONCEPT_NEED_NOTE_MAX).toBe(MODE_MAP_NODE_TEXT_MAX);
  });

  it('худшее тело (пять потребностей, заметки на пределе) меньше потолка тела запроса', () => {
    const note = 'ж'.repeat(CONCEPT_NEED_NOTE_MAX); // кириллица: 2 байта на знак
    const needLinks = NEED_IDS.map((needId) => ({
      needId,
      ratings: { child: 10, teen: 10, now: 10 },
      notes: { child: note, teen: note, now: note },
    }));
    const bytes = Buffer.byteLength(JSON.stringify({ needLinks }), 'utf8');
    expect(bytes).toBeLessThan(BODY_LIMIT_BYTES);
  });
});

// Колесо правит холст; вкладка «Концептуализация» шлёт концептуализацию из
// своего состояния и затирать его не должна — поле в её теле не существует.
describe('полное сохранение концептуализации needLinks не принимает', () => {
  it('whitelist срезает needLinks из тела ConceptSaveDto', async () => {
    const dto = plainToInstance(ConceptSaveDto, {
      goals: 'цели',
      needLinks: [{ needId: 'play', ratings: { now: 5 }, notes: {} }],
    });
    await expect(validate(dto, { whitelist: true })).resolves.toEqual([]);
    expect(dto).not.toHaveProperty('needLinks');
    expect(dto.goals).toBe('цели');
  });
});

describe('сверка с контрактом фронта (needLinks.ts)', () => {
  const src = readFileSync(
    join(__dirname, '../../../shared/src/therapy/conceptGraph/needLinks.ts'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

  it('поля ConceptNeedLink = свойства DTO записи', () => {
    const body = /export interface ConceptNeedLink \{([^}]*)\}/.exec(src);
    expect(body).not.toBeNull();
    const props = [...body![1].matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
    expect(props.sort()).toEqual(dtoProps(ConceptNeedLinkDto));
    // Контрольный образец: парсер видит все поля, а не первое.
    expect(props).toEqual(['needId', 'notes', 'ratings']);
  });

  it('периоды NEED_PERIODS = свойства DTO оценок и заметок', () => {
    const list = /NEED_PERIODS[^=]*=\s*\[([^\]]*)\]/.exec(src);
    expect(list).not.toBeNull();
    const periods = [...list![1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(periods).toEqual([...NEED_PERIODS]);
    expect(dtoProps(ConceptNeedRatingsDto)).toEqual([...periods].sort());
    expect(dtoProps(ConceptNeedNotesDto)).toEqual([...periods].sort());
  });

  it('шкала: верхняя граница оценки у фронта = NEED_RATING_MAX', () => {
    const max = /const isRating[\s\S]*?<=\s*(\d+)/.exec(src);
    expect(max).not.toBeNull();
    expect(Number(max![1])).toBe(NEED_RATING_MAX);
  });
});
