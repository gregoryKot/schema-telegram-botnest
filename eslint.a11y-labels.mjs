// Имя у контрола (аудит 2026-10-11, «Доступность»). Правило
// jsx-a11y/control-has-associated-label в recommended не входит, поэтому
// волна aria-label 2026-07 ничем не держалась и класс вернулся с новым кодом
// (безымянные switch и progressbar). Глиф «←» правило считает подписью —
// эту половину класса держит scripts/check-glyph-controls.mjs.
//
// Один источник опций для webapp/eslint.config.js и блока shared/src в
// корневом eslint.config.mjs (оба файла под храповиком размера, правило №10).
// Мини-апп не покрыт: он удаляется (docs/ONE_FRONTEND_PLAN.md).

export const controlLabelRule = {
  'jsx-a11y/control-has-associated-label': [
    'error',
    {
      // Поля подписываются <label>/aria-label/datalist, а не содержимым;
      // для них есть label-has-associated-control из recommended.
      ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'select', 'option', 'tr', 'video'],
      // Контейнерные роли: имя несут их дочерние элементы.
      ignoreRoles: ['grid', 'listbox', 'menu', 'menubar', 'radiogroup', 'row', 'tablist', 'toolbar', 'tree', 'treegrid'],
      depth: 3,
    },
  ],
};

/** a11y-блок для shared/src: общий код фронтов, до 2026-10 jsx-a11y не линтовался вовсе. */
export const sharedA11yBlock = (jsxA11y) => ({
  files: ['shared/src/**/*.{ts,tsx}'],
  plugins: jsxA11y.flatConfigs.recommended.plugins,
  rules: { ...jsxA11y.flatConfigs.recommended.rules, ...controlLabelRule },
});
