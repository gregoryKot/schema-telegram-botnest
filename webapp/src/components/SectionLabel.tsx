interface Props {
  children: React.ReactNode;
  purple?: boolean;
  mb?: number;
}

export function SectionLabel({ children, purple = false, mb = 10 }: Props) {
  return (
    <div className="eyebrow" style={{
      color: purple ? 'var(--accent)' : undefined,
      marginBottom: mb,
    }}>
      {children}
    </div>
  );
}
