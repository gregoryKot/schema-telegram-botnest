// Шапка BottomSheet-экранов ресурсов (Тёплые слова, Письмо Уязвимому
// Ребёнку, Безопасное место): заголовок + подзаголовок. Одна механика — один
// компонент (см. CLAUDE.md): раньше разметка была продублирована в каждом
// экране.
//
// Плашки 44×44 с эмодзи больше нет: на трёх соседних экранах она давала три
// разных цветных пятна на одном месте, и глаз считывал пятно раньше названия.
// Название набрано серифом — оно и отличает экраны друг от друга.
interface Props {
  title: React.ReactNode;
  subtitle: React.ReactNode;
}

export function SheetIconHeader({ title, subtitle }: Props) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="d-display" style={{ fontSize: 21, color: 'var(--text)' }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          marginTop: 4,
          lineHeight: 1.45,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}
