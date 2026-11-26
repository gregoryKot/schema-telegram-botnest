// Запись id справочника в данные клиента: неизвестный id → 400 на каждой ручке,
// известный и свой режим терапевта (`cm_…`) — проходят. Пайп — как в приложении.
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConceptSaveDto } from './concept-save.dto';
import { ConceptAppendDto } from './concept-append.dto';
import { CreateSessionNoteDto } from './client-data.dto';
import { ModeNoteDto, SchemaNoteDto } from '../../api/dto/notes.dto';

const pipe = new ValidationPipe({ whitelist: true });
const run = (metatype: new () => object, body: unknown) =>
  pipe.transform(body, { type: 'body', metatype });

const work = (over: Record<string, unknown>) => ({
  date: '2026-11-20',
  text: '',
  work: [{ id: 'w1', kind: 'custom', ...over }],
});

// [ручка, DTO, тело с известными id, тело с неизвестным id]
const CASES: [string, new () => object, unknown, unknown][] = [
  [
    'концепт: schemaIds',
    ConceptSaveDto,
    { schemaIds: ['abandonment'] },
    { schemaIds: ['abandonmen'] },
  ],
  [
    'концепт: modeIds',
    ConceptSaveDto,
    { modeIds: ['healthy_adult', 'cm_abc1'] },
    { modeIds: ['healthy'] },
  ],
  [
    'концепт: modeLinks.modeId',
    ConceptSaveDto,
    { modeLinks: [{ modeId: 'punitive_critic' }] },
    { modeLinks: [{ modeId: 'critic' }] },
  ],
  [
    'концепт: modeLinks.schemaIds',
    ConceptSaveDto,
    { modeLinks: [{ modeId: 'punitive_critic', schemaIds: ['failure'] }] },
    { modeLinks: [{ modeId: 'punitive_critic', schemaIds: ['fail'] }] },
  ],
  [
    'концепт: modeLinks.needIds',
    ConceptSaveDto,
    { modeLinks: [{ modeId: 'punitive_critic', needIds: ['play'] }] },
    { modeLinks: [{ modeId: 'punitive_critic', needIds: ['fun'] }] },
  ],
  [
    'концепт: schemaLinks',
    ConceptSaveDto,
    { schemaLinks: [{ schemaId: 'mistrust', needIds: ['limits'] }] },
    { schemaLinks: [{ schemaId: 'trust' }] },
  ],
  [
    'концепт: патч связей режима',
    ConceptSaveDto,
    { modeLinksPatch: { upsert: [{ modeId: 'angry_child' }] } },
    { modeLinksPatch: { upsert: [{ modeId: 'angry' }] } },
  ],
  [
    'концепт: патч связей схемы',
    ConceptSaveDto,
    { schemaLinksPatch: { upsert: [{ schemaId: 'failure' }] } },
    { schemaLinksPatch: { upsert: [{ schemaId: 'failure', needIds: ['x'] }] } },
  ],
  [
    'дописать с холста: id',
    ConceptAppendDto,
    { modeIds: ['angry_child'], schemaIds: ['failure'] },
    { schemaIds: ['nope'] },
  ],
  [
    'дописать с холста: линии',
    ConceptAppendDto,
    {
      modeLinks: [{ modeId: 'angry_child', schemaIds: ['failure'] }],
      schemaLinks: [{ schemaId: 'failure', needIds: ['play'] }],
    },
    { modeLinks: [{ modeId: 'angry_child', schemaIds: ['nope'] }] },
  ],
  [
    '«Что делали»: modeIds',
    CreateSessionNoteDto,
    work({ modeIds: ['angry_child', 'cm_x9'] }),
    work({ modeIds: ['angry'] }),
  ],
  [
    '«Что делали»: schemaIds',
    CreateSessionNoteDto,
    work({ schemaIds: ['failure'] }),
    work({ schemaIds: ['fail'] }),
  ],
  [
    '«Что делали»: needIds',
    CreateSessionNoteDto,
    work({ needIds: ['autonomy'] }),
    work({ needIds: ['freedom'] }),
  ],
  [
    'заметка о схеме',
    SchemaNoteDto,
    { schemaId: 'failure' },
    { schemaId: 'no_such_schema' },
  ],
  [
    'заметка о режиме',
    ModeNoteDto,
    { modeId: 'angry_child' },
    { modeId: 'cm_abc1' },
  ],
];

describe.each(CASES)('%s', (_name, dto, known, unknown) => {
  it('известный id проходит', async () => {
    await expect(run(dto, known)).resolves.toBeDefined();
  });

  it('неизвестный id → 400', async () => {
    await expect(run(dto, unknown)).rejects.toBeInstanceOf(BadRequestException);
  });
});
