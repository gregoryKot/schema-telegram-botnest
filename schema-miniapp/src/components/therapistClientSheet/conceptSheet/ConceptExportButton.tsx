import { CONCEPT_EXPORT_EMPTY } from '../../../../../shared/src/therapy/conceptExport';
import type { ClientDetail } from '../types';

// Низ листа концептуализации: «↗ Экспорт / Поделиться» (вынесена из ConceptSheet
// по правилу №10 вместе со сводкой «Коротко», #902). После копирования подпись
// «✓ Скопировано» зелёным токеном, не литералом (check-color-drift). Пустой
// концепт: кнопка недоступна, а подпись объясняет почему (QA 2026-11).
export function ConceptExportButton({
  detail,
}: {
  detail: Pick<ClientDetail, 'exportCopied' | 'exportEmpty' | 'handleExport'>;
}) {
  const { exportCopied: copied, exportEmpty: empty, handleExport } = detail;
  return (
    <button
      onClick={handleExport}
      disabled={empty}
      style={{
        width: '100%',
        marginTop: 8,
        padding: '11px 0',
        borderRadius: 'var(--r-14)',
        border: '1px solid rgba(var(--fg-rgb),0.1)',
        background: copied
          ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
          : 'transparent',
        color: copied ? 'var(--accent-green)' : 'rgba(var(--fg-rgb),0.4)',
        fontSize: 13,
        fontWeight: 500,
        cursor: empty ? 'default' : 'pointer',
      }}
    >
      {empty
        ? CONCEPT_EXPORT_EMPTY
        : copied
          ? '✓ Скопировано'
          : '↗ Экспорт / Поделиться'}
    </button>
  );
}
