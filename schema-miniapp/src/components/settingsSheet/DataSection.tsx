import { Row, SettingsLabel } from './primitives';

export function DataSection({
  onShowPrivacy,
  onShowDelete,
}: {
  onShowPrivacy: () => void;
  onShowDelete: () => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ДАННЫЕ</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <Row
          label="О данных и конфиденциальности"
          emoji="🔒"
          onClick={onShowPrivacy}
        />
        <Row
          label="Удалить все данные"
          emoji="🗑"
          divider
          color="#f87171"
          onClick={onShowDelete}
        />
      </div>
    </div>
  );
}
