interface Props {
  children: React.ReactNode;
  purple?: boolean;
  mb?: number;
}

export function SectionLabel({ children, purple = false, mb = 10 }: Props) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: purple ? 600 : 500,
      color: purple ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.3)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: mb,
    }}>
      {children}
    </div>
  );
}
