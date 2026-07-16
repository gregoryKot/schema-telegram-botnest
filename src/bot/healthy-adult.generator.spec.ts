import { Logger } from '@nestjs/common';

// Мок официального SDK: конструктор возвращает объект с messages.create.
const createMock = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

import { HealthyAdultGeneratorService } from './healthy-adult.generator';

const text = (t: string) => ({ content: [{ type: 'text', text: t }] });

describe('HealthyAdultGeneratorService', () => {
  const OLD = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (OLD === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = OLD;
    createMock.mockReset();
    jest.restoreAllMocks();
  });

  it('без ключа выключен и возвращает null (→ фолбэк на пул)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const svc = new HealthyAdultGeneratorService();
    expect(svc.enabled).toBe(false);
    expect(await svc.generate([])).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('с ключом генерирует и обрезает обёртки-кавычки', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    createMock.mockResolvedValueOnce(text('«Сегодня можно сбавить темп.»'));
    const svc = new HealthyAdultGeneratorService();
    expect(svc.enabled).toBe(true);
    expect(await svc.generate([])).toBe('Сегодня можно сбавить темп.');
  });

  it('отбрасывает точный дубль недавнего (→ фолбэк)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    createMock.mockResolvedValueOnce(text('уже было'));
    const svc = new HealthyAdultGeneratorService();
    expect(await svc.generate(['уже было'])).toBeNull();
  });

  it('отбрасывает слишком длинный ответ', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    createMock.mockResolvedValueOnce(text('я'.repeat(700)));
    const svc = new HealthyAdultGeneratorService();
    expect(await svc.generate([])).toBeNull();
  });

  it('не падает при ошибке API, возвращает null', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    createMock.mockRejectedValueOnce(new Error('rate limit'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const svc = new HealthyAdultGeneratorService();
    expect(await svc.generate([])).toBeNull();
  });
});
