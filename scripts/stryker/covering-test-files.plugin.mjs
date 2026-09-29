// Stryker-плагин фильтра покрывающих спеков — зачем он и как работает, см.
// covering-test-files.cjs. Отдельным ESM-файлом, потому что плагин
// объявляется через ESM-пакет @stryker-mutator/api, а jest грузит `filter`
// через require().
import { declareClassPlugin, PluginKind } from '@stryker-mutator/api/plugin';
import coveringTestFiles from './covering-test-files.cjs';

const { MAP_ENV, defaultMapPath, CoveringTestFilesReporter } =
  coveringTestFiles;

// Плагины грузятся в главном процессе до того, как Stryker форкает воркеры, а
// воркер получает окружение родителя — так путь к карте доходит до
// jest-фильтра в каждом из них.
process.env[MAP_ENV] ??= defaultMapPath();

export const strykerPlugins = [
  declareClassPlugin(
    PluginKind.Reporter,
    'covering-test-files',
    CoveringTestFilesReporter,
  ),
];
