// Общие типы, хелперы и пустое состояние для вкладок «Мои записи».
// Вынесено из MyNotesSheet.tsx (правило №10). Поведение не менялось.

export type SchemaNote = {
  schemaId: string;
  triggers: string;
  feelings: string;
  thoughts: string;
  origins: string;
  reality: string;
  healthyView: string;
  behavior: string;
};
export type ModeNote = {
  modeId: string;
  triggers: string;
  feelings: string;
  thoughts: string;
  needs: string;
  behavior: string;
};
export type DiaryEntry = {
  id: number;
  createdAt: string;
  type: 'schema' | 'mode' | 'gratitude';
  label: string;
  preview: string;
};
export type Exercise = {
  id: number;
  createdAt: string;
  type: 'belief' | 'letter' | 'flashcard';
  label: string;
  preview: string;
};
export type SafeEntry = { description: string; updatedAt: string } | null;

const VAR_HEX: Record<string, string> = {
  'var(--accent-red)': '#f87171',
  'var(--accent-orange)': '#fb923c',
  'var(--accent-yellow)': '#facc15',
  'var(--accent-green)': '#34d399',
  'var(--accent-indigo)': '#818cf8',
  'var(--accent-blue)': '#60a5fa',
  'var(--accent)': '#a78bfa',
};
export function hex(color: string) {
  return VAR_HEX[color] ?? color;
}

export function notePreview(note: SchemaNote | ModeNote): string {
  const skip = new Set(['schemaId', 'modeId']);
  for (const [k, v] of Object.entries(note)) {
    if (!skip.has(k) && typeof v === 'string' && v.trim()) {
      const s = v.trim();
      return s.length > 70 ? s.slice(0, 70) + '…' : s;
    }
  }
  return '';
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export function EmptyState({
  emoji,
  text,
  sub,
}: {
  emoji: string;
  text: string;
  sub: string;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>{emoji}</div>
      <div style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6 }}>
        {text}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 8 }}>
        {sub}
      </div>
    </div>
  );
}
