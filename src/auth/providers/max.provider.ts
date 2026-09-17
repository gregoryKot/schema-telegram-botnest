import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProviderHandler, ProviderIdentity } from './types';
import { MaxNotConfiguredError, verifyMaxInitData } from '../max-init-data';

// MAX mini-app initData verification. Spec: dev.max.ru/docs/webapps/validation.
// Токен бота MAX — не связан с Telegram BOT_TOKEN.
//
// Почему два имени. Подпись initData считается по токену того бота, под
// которым зарегистрировано мини-приложение. У нас это тот же бот, что
// публикует канал «Здоровый Взрослый», и его токен уже лежит в
// HEALTHY_ADULT_MAX_TOKEN — заводить рядом вторую переменную с тем же
// секретом значит обязать себя ротировать их синхронно: забудешь одну и
// либо канал молча перестанет постить, либо все входы начнут падать.
//
// Поэтому MAX_BOT_TOKEN необязателен и просто перекрывает канальный, если
// когда-нибудь мини-апп переедет под отдельного бота. Порядок именно такой:
// явная переменная сильнее унаследованной.
const TOKEN_ENVS = ['MAX_BOT_TOKEN', 'HEALTHY_ADULT_MAX_TOKEN'] as const;

@Injectable()
export class MaxProvider implements AuthProviderHandler {
  readonly id = 'max';
  readonly displayName = 'MAX';

  constructor(private readonly config: ConfigService) {}

  verifyInitData(initData: string): ProviderIdentity {
    const botToken = TOKEN_ENVS.map((k) =>
      this.config.get<string>(k)?.trim(),
    ).find((v) => !!v);
    // Не UnauthorizedException: незаданный токен — наша конфигурация, а не
    // плохая подпись. Иначе она уедет админу как «подделка» (см. класс).
    if (!botToken) throw new MaxNotConfiguredError();
    // Ошибки verifyMaxInitData (включая 'init data expired ...') намеренно
    // не перехватываются здесь — их классифицирует rejectInitData на
    // вызывающей стороне (src/api/initdata-alert.ts).
    const { id, firstName } = verifyMaxInitData(initData, botToken);
    return { providerId: id, displayName: firstName };
  }
}
