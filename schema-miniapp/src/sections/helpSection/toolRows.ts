// Строки «Инструментов» переехали в shared (их же берёт «Практика» сайта,
// правило №3). Реэкспорт — чтобы импорты мини-аппа остались прежними.
export {
  buildToolRows,
  type ToolRowDef,
  type ToolRowsProps,
} from '../../../../shared/src/quickActions/toolRows';
