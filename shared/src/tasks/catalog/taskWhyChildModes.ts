// «Зачем» у заданий детских режимов, вынесенных из taskWhyModes.ts; обращения в текстах нет.
import { buildAbandonedTaskWhy } from './taskWhyAbandoned';
import { buildHealthyTaskWhy } from './taskWhyHealthy';

export const buildChildModesTaskWhy = (): Record<string, string> => ({
  ...buildAbandonedTaskWhy(),
  ...buildHealthyTaskWhy(),
  'выпустить-гнев-телом':
    'Пока гнев держат в себе, тело остаётся напряжённым, и злость вырывается в неподходящий момент. Безопасная разрядка снимает напряжение, а внимание к своим потребностям помогает просить о них раньше, чем накопится вспышка.',
});
