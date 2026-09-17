import { useTr } from '../../utils/addressForm';

// Пустое/аварийное состояние списка клиентов. Сбой ≠ пусто (CLAUDE.md):
// терапевт с полным ростером в офлайне не должен увидеть онбординг
// «клиентов нет» — раньше отказ загрузки выглядел ровно так.
export function ListEmptyState({ failed }: { failed: boolean }) {
  const tr = useTr();
  const style = {
    color: failed ? 'var(--accent-red)' : 'var(--text-sub)',
    fontSize: 14,
    textAlign: 'center' as const,
    paddingTop: 20,
    lineHeight: 1.8,
  };
  if (failed) {
    return (
      <div style={style}>
        Не удалось загрузить клиентов.
        <br />
        {tr(
          'Проверь подключение и попробуй ещё раз.',
          'Проверьте подключение и попробуйте ещё раз.',
        )}
      </div>
    );
  }
  return (
    <div style={style}>
      Нет подключённых клиентов.
      <br />
      {tr('Нажми', 'Нажмите')}{' '}
      <strong style={{ color: 'var(--accent)' }}>+</strong> чтобы добавить.
    </div>
  );
}
