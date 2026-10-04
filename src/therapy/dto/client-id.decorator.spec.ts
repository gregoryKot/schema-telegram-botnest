import { plainToInstance } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { ClientIdField } from './client-id.decorator';
import { CreateTaskDto } from './tasks.dto';

class Probe {
  @IsOptional()
  @ClientIdField()
  clientId?: string;
}

const errorsFor = async (cls: new () => object, body: object) =>
  (await validate(plainToInstance(cls, body))).map((e) => e.property);

// Аудит 2026-10, X-1: clientId веб-клиента (> 2^53) приходит строкой.
describe('ClientIdField', () => {
  it('строка с веб-id и виртуальный отрицательный проходят как есть', async () => {
    const dto = plainToInstance(Probe, { clientId: '1000000000000000123' });
    expect(dto.clientId).toBe('1000000000000000123');
    await expect(validate(dto)).resolves.toHaveLength(0);
    await expect(errorsFor(Probe, { clientId: '-3' })).resolves.toEqual([]);
  });

  it('число из старых клиентов приводится к строке', async () => {
    const dto = plainToInstance(Probe, { clientId: 555 });
    expect(dto.clientId).toBe('555');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('мусор, дробное, экспонента и слишком длинное — отказ', async () => {
    const bad = ['abc', '12abc', '1.5', 1.5, 1e21, '', '12345678901234567890'];
    for (const clientId of bad) {
      await expect(errorsFor(Probe, { clientId })).resolves.toEqual([
        'clientId',
      ]);
    }
  });

  it('отсутствие поля допустимо (своя задача)', async () => {
    await expect(errorsFor(Probe, {})).resolves.toEqual([]);
  });

  it('CreateTaskDto берёт clientId строкой', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      type: 'custom',
      text: 'x',
      clientId: '1000000000000000123',
    });
    expect(dto.clientId).toBe('1000000000000000123');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
