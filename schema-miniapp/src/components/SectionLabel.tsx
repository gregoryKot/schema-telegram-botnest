interface Props {
  children: React.ReactNode;
  purple?: boolean;
  mb?: number;
  /** В8 дизайн-аудита 2026-08: SectionLabel рендерит и подзаголовки блоков
   * внутри шита (h3, дефолт — большинство мест), и единственный заголовок
   * самого шита там, где под ним нет другого титульного элемента (h2 —
   * NoteSheet/IndexInfoSheet/AboutSheet/NeedDisclaimerSheet/TaskCreateSheet).
   * Стили не меняются ни на пиксель — только тег. */
  as?: 'h2' | 'h3';
}

export function SectionLabel({
  children,
  purple = false,
  mb = 10,
  as = 'h3',
}: Props) {
  const Tag = as;
  return (
    <Tag
      style={{
        fontSize: 11,
        fontWeight: purple ? 600 : 500,
        color: purple ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.3)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: mb,
        marginTop: 0,
      }}
    >
      {children}
    </Tag>
  );
}
