// Ключи, глушащие шаг или джобу воркфлоу (`if`, `shell`,
// `continue-on-error`), для гейта lockfile-audit.ts. Вынесено оттуда
// (храповик размера, правило №10).
//
// Ключ YAML сверяется в трёх формах: голый, в кавычках (`"if":`, `'shell':`)
// и с пробелом перед двоеточием (`if :`) — js-yaml и Actions читают их
// одинаково, а регэксп только на `if:` их пропускал (остаток #821).
const yamlKey = (name: string, indent = '\\s*', tail = ''): RegExp =>
  new RegExp(`^${indent}(?:${name}|"${name}"|'${name}')[ \\t]*:${tail}`, 'm');

export const GUARD = {
  /** `continue-on-error` с любым значением, кроме `false`: `${{ true }}` тоже глушит. */
  softFail: yamlKey('continue-on-error', '\\s*', '(?!\\s*false\\s*(?:#.*)?$)'),
  /** Свой shell (`bash {0}` без `-e`) — у шага, джобы или в defaults. */
  shell: yamlKey('shell'),
  /** `if:` шага — ключ на отступе 8 (или первым после `- `). */
  stepIf: yamlKey('if', '(?: {8})?'),
  /** `if:` джобы — отступ 4. */
  jobIf: yamlKey('if', ' {4}'),
};
