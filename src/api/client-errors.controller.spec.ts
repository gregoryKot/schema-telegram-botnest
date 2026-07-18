import { Logger } from '@nestjs/common';
import { ClientErrorsController } from './client-errors.controller';
import { ClientErrorDto } from './dto/client-error.dto';

// Best-practice «видимость прода» (2026-07): краш фронтенда обязан доехать
// до AlertLogger (→ DM админу). Тест фиксирует, что контроллер логирует
// через .error() с распознаваемым префиксом [client:<source>] — иначе
// изменение формата тихо оборвёт единственный канал видимости UI-крашей.
describe('ClientErrorsController', () => {
  let controller: ClientErrorsController;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new ClientErrorsController();
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('логирует ошибку через .error() с префиксом источника', () => {
    const dto: ClientErrorDto = {
      message: 'Cannot read properties of undefined',
      section: 'DiaryOverlay',
      source: 'webapp',
      stack: 'Error: boom\n  at X',
    };
    controller.report(dto);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, stack] = errorSpy.mock.calls[0] as [string, string];
    expect(msg).toContain('[client:webapp]');
    expect(msg).toContain('DiaryOverlay');
    expect(msg).toContain('Cannot read properties of undefined');
    expect(stack).toBe('Error: boom\n  at X');
  });

  it('включает url когда он передан, и падает обратно на componentStack', () => {
    controller.report({
      message: 'boom',
      section: 'Sections',
      source: 'miniapp',
      componentStack: '\n  in App',
      url: 'https://schemehappens.ru/app/',
    });
    const [msg, stack] = errorSpy.mock.calls[0] as [string, string];
    expect(msg).toContain('[client:miniapp]');
    expect(msg).toContain('@ https://schemehappens.ru/app/');
    expect(stack).toBe('\n  in App');
  });
});
