// Стили копинга в связи схемы (#1484): закрытый список стилей, заметка с верхней границей.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConceptualizationDto } from './conceptualization.dto';
import { CONCEPT_COPING_NOTE_MAX } from '../../utils/text-limits';

const link = (over: Record<string, unknown>) => ({
  schemaId: 'subjugation',
  ...over,
});

async function errorsFor(over: Record<string, unknown>) {
  const dto = plainToInstance(ConceptualizationDto, {
    schemaLinks: [link(over)],
  });
  const errs = await validate(dto, { whitelist: true });
  return { errs: errs.map((e) => e.property), dto };
}

describe('ConceptSchemaLinkDto: coping и copingNotes', () => {
  it('три стиля с заметкой на пределе проходят', async () => {
    const { errs } = await errorsFor({
      coping: ['surrender', 'avoidance', 'overcompensation'],
      copingNotes: { surrender: 'ж'.repeat(CONCEPT_COPING_NOTE_MAX) },
    });
    expect(errs).toEqual([]);
  });

  it.each([
    ['чужой стиль', { coping: ['denial'] }],
    ['дубль стиля', { coping: ['surrender', 'surrender'] }],
    ['не массив', { coping: 'surrender' }],
    [
      'заметка длиннее предела',
      { copingNotes: { avoidance: 'ж'.repeat(CONCEPT_COPING_NOTE_MAX + 1) } },
    ],
    ['заметка не строка', { copingNotes: { avoidance: 5 } }],
  ])('%s — отказ', async (_name, over) => {
    const { errs } = await errorsFor(over);
    expect(errs).toContain('schemaLinks');
  });

  it('лишний ключ заметок вырезается whitelist-ом', async () => {
    const { errs, dto } = await errorsFor({
      coping: ['avoidance'],
      copingNotes: { avoidance: 'молчит', clientId: '555' },
    });
    expect(errs).toEqual([]);
    expect(dto.schemaLinks![0].copingNotes).toEqual({ avoidance: 'молчит' });
  });
});
