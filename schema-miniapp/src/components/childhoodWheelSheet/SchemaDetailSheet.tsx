import { BottomSheet } from '../BottomSheet';

export function SchemaDetailSheet({
  schema,
  onClose,
}: {
  schema: { name: string; desc: string; color: string };
  onClose: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: schema.color,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.3,
            }}
          >
            {schema.name}
          </div>
        </div>
        <div
          style={{
            fontSize: 15,
            color: 'rgba(var(--fg-rgb),0.7)',
            lineHeight: 1.7,
          }}
        >
          {schema.desc}
        </div>
      </div>
    </BottomSheet>
  );
}
