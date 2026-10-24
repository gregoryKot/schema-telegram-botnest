import { builtAt } from '../../utils/build-info';
import { Probe } from './types';

type Env = Record<string, string | undefined>;

/**
 * Процесс прод-образа обязан работать в режиме production. Образ ставит его
 * сам (`ENV NODE_ENV=production`), но env_file/панель хостинга сильнее: строка
 * `NODE_ENV=development` в PROD_ENV молча включает режим разработки
 * (шифрование без ключа пропускает текст насквозь, проверки env становятся
 * предупреждениями). Отличить прод-образ от локального запуска по самому
 * NODE_ENV нельзя, поэтому признак независимый: метка BUILD_INFO, которую
 * пишет только Dockerfile. Значение режима в detail не печатается.
 */
export function runtimeModeProbe(
  env: Env = process.env,
  isBuiltImage: () => boolean = () => builtAt() !== null,
): Probe {
  return {
    id: 'runtimeMode',
    title: 'Режим работы прод-образа',
    critical: true,
    run() {
      if (!isBuiltImage()) {
        return Promise.resolve({
          ok: true,
          detail: 'локальный запуск без метки сборки, режим не проверяется',
        });
      }
      return Promise.resolve(
        env.NODE_ENV === 'production'
          ? { ok: true, detail: 'образ работает в режиме production' }
          : {
              ok: false,
              detail:
                'образ собран для прода, но NODE_ENV не production: режим разработки на проде (проверить PROD_ENV и env хостинга)',
            },
      );
    },
  };
}
