// Проводка op=grant-root в .github/workflows/vps.yml. Сам workflow здесь не
// запускается; пинится то, что ломается тихо: шаги для root (mkdir в /opt,
// scp) не должны идти до выдачи root, а выдача должна идти в правильном
// порядке и проверять uid, а не код возврата (заглушка cloud-init отвечает на
// любую команду нулём). Скрипт grant-root.sh — vps-grant-root.spec.ts.
import { readFileSync } from 'fs';
import { join } from 'path';

const yml = readFileSync(
  join(process.cwd(), '.github', 'workflows', 'vps.yml'),
  'utf8',
);
const step = (name: string) => {
  const parts = yml.split(/^ {6}- /m).slice(1);
  const found = parts.find((p) => p.includes(`name: ${name}\n`));
  if (!found) throw new Error(`шага «${name}» нет в vps.yml`);
  return found;
};

describe('.github/workflows/vps.yml: op=grant-root', () => {
  it('grant-root есть в списке операций, секрет DEPLOY_USER передаётся в env', () => {
    expect(yml).toMatch(/options:[\s\S]*- grant-root\n/);
    expect(yml).toContain('DEPLOY_USER: ${{ secrets.DEPLOY_USER }}');
  });

  it.each(['Настройка ssh', 'Копирование deploy/vps на сервер', 'Операция'])(
    'шаг «%s» (рассчитан на root) пропускается при grant-root',
    (name) => {
      expect(step(name)).toContain("inputs.op != 'grant-root'");
    },
  );

  it('шаг «Операция» не знает grant-root: через case его не запустить', () => {
    expect(step('Операция')).not.toMatch(/grant-root\)|\|grant-root/);
  });

  describe('шаг «Выдача root-доступа»', () => {
    const body = () => step('Выдача root-доступа');

    it('идёт только для grant-root', () => {
      expect(body()).toContain("inputs.op == 'grant-root'");
    });

    it('нет DEPLOY_USER: ::error:: с названием секрета до любого ssh', () => {
      const text = body();
      const guard = text.indexOf('-z "$DEPLOY_USER"');
      expect(guard).toBeGreaterThan(-1);
      expect(
        text.indexOf('::error::grant-root: не задан секрет DEPLOY_USER'),
      ).toBeGreaterThan(guard);
      expect(guard).toBeLessThan(text.indexOf('ssh-setup.sh'));
    });

    it('порядок: алиас под пользователем → grant-root.sh через stdin → алиас под root → проверка uid → строка в лог', () => {
      const text = body();
      const order = [
        'SSH_USER="$DEPLOY_USER" bash deploy/vps/ssh-setup.sh',
        "ssh vps 'bash -s' < deploy/vps/grant-root.sh",
        'SSH_USER=root bash deploy/vps/ssh-setup.sh',
        "$(ssh vps 'id -u')",
        'echo "root по ключу доступен"',
      ].map((s) => text.indexOf(s));

      expect(order.every((i) => i >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
  });
});
