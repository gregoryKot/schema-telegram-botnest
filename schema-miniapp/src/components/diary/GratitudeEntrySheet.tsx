import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { fmtDateLong, todayStr } from '../../utils/format';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { DiaryPanel } from './diaryUi';
import { PrimaryAction } from './diaryFlowUi';

interface Props {
  onClose: () => void;
  date: string;
  existingItems?: string[];
  onSave: (date: string, items: string[]) => Promise<void>;
}

export function GratitudeEntrySheet({
  onClose,
  date,
  existingItems,
  onSave,
}: Props) {
  const tr = useTr();
  const existing = !existingItems
    ? loadDraft<{ items: string[] }>('gratitude')
    : null;
  const initItems = existingItems ?? existing?.data?.items ?? ['', '', ''];

  const [items, setItems] = useState<string[]>(initItems);
  const [saving, setSaving] = useState(false);
  // Отказ сохранения раньше сообщался ТОЛЬКО вибрацией haptic.error(), а лист
  // всё равно закрывался: на десктопе вибрации нет вовсе, и человек считал,
  // что запись сохранена. Текст уцелел бы черновиком, но об этом тоже никто
  // не сообщал.
  const [saveError, setSaveError] = useState(false);

  const update = (i: number, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? v : it)));

  useEffect(() => {
    if (!existingItems) saveDraft('gratitude', { items });
  }, [items, existingItems]);

  const canSave = items.filter((it) => it.trim().length > 0).length >= 1;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaveError(false);
    haptic.success();
    setSaving(true);
    try {
      await onSave(
        date,
        items.filter((it) => it.trim().length > 0),
      );
      clearDraft('gratitude');
      onClose();
    } catch {
      haptic.error();
      setSaveError(true); // лист НЕ закрываем — иначе отказ неотличим от успеха
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = date === todayStr() ? 'сегодня' : fmtDateLong(date);

  const PLACEHOLDERS = [
    'Что-то хорошее, что произошло сегодня...',
    'Кто-то, кто помог или поддержал...',
    'Момент, который хочется запомнить...',
    'Что-то простое, что согрело...',
    'Что-то, что обычно ускользает...',
  ];

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div className="d-caps" style={{ marginBottom: 14 }}>
          Дневник благодарности · {dateLabel}
        </div>
        <div className="d-display" style={{ fontSize: 21, marginBottom: 8 }}>
          За что есть благодарность сегодня?
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--muted)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Даже самое маленькое — оно считается. Хватит и одной строки.
        </div>

        {/* Три строки в одном контейнере: без иконок и нумерованных плашек —
            границу между строками держит волосяная линия. */}
        <DiaryPanel>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                padding: '4px 14px',
                borderTop: i === 0 ? undefined : '1px solid var(--line)',
              }}
            >
              <textarea
                value={item}
                onChange={(e) => update(i, e.target.value)}
                placeholder={
                  PLACEHOLDERS[i] ?? PLACEHOLDERS[PLACEHOLDERS.length - 1]
                }
                rows={2}
                aria-label={`Благодарность ${i + 1}`}
                style={{
                  width: '100%',
                  minHeight: 48,
                  background: 'none',
                  border: 'none',
                  padding: '12px 0',
                  color: 'var(--text)',
                  fontSize: 15,
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'none',
                }}
              />
            </div>
          ))}
        </DiaryPanel>

        {detectCrisisAny(...items) && <CrisisCard surface="gratitude" />}

        {items.length < 5 && (
          <button
            onClick={() => setItems((prev) => [...prev, ''])}
            style={{
              background: 'none',
              border: 'none',
              padding: '18px 2px',
              minHeight: 48,
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Добавить строку
          </button>
        )}

        <div style={{ marginTop: 12 }}>
          <PrimaryAction
            label={saving ? 'Сохраняю…' : 'Сохранить'}
            hint={tr(
              'Напиши хотя бы одну строку — и запись сохранится',
              'Напишите хотя бы одну строку — и запись сохранится',
            )}
            disabled={!canSave || saving}
            onClick={handleSave}
          />
        </div>
        {saveError && (
          <div
            role="status"
            style={{
              marginTop: 10,
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--accent-red)',
            }}
          >
            Не удалось сохранить. Текст остался черновиком — можно повторить
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
