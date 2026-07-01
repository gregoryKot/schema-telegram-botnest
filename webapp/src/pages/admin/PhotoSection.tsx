import { useState, useEffect } from 'react';
import { api } from '../../api';
import { card, btn } from './shared';

const MAX_WIDTH = 800;
const MAX_DATA_URI_BYTES = 200 * 1024; // stay under the 220kb server-side limit

// Resizes to MAX_WIDTH and re-compresses as JPEG, lowering quality until the
// data URI fits the size budget (a hero photo doesn't need to be pixel-perfect).
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.85;
  let dataUri = canvas.toDataURL('image/jpeg', quality);
  while (dataUri.length > MAX_DATA_URI_BYTES && quality > 0.3) {
    quality -= 0.1;
    dataUri = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUri.length > MAX_DATA_URI_BYTES) throw new Error('Не удалось сжать фото до нужного размера');
  return dataUri;
}

/** Photo admin tab: upload + client-side compress the hero photo shown on the landing page. */
export function PhotoSection({ adminKey }: { adminKey: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.getSiteContent().then(c => setCurrent(c.heroPhoto)).catch(() => {}); }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setPreview(await compressImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обработать фото');
    }
  };

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      await api.adminSetHeroPhoto(adminKey, preview);
      setCurrent(preview);
      setPreview(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Фото на сайте</h2>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 16 }}>Используется в блоке «Обо мне» и в шапке. Загрузите новое фото — оно автоматически сожмётся под нужный размер.</p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 8px' }}>Сейчас на сайте</p>
          <img src={current ?? '/gregory.jpg'} alt="Текущее фото" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 14, border: '1px solid var(--line)' }} />
        </div>
        {preview && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 8px' }}>Новое (превью)</p>
            <img src={preview} alt="Новое фото" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 14, border: '1px solid var(--accent)' }} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <input type="file" accept="image/*" onChange={onFile} />
      </div>

      {error && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
      {saved && <p style={{ color: '#4a6335', fontSize: 13, margin: '10px 0 0' }}>Фото сохранено ✓</p>}

      {preview && (
        <div style={{ marginTop: 16 }}>
          <button style={btn} onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить фото'}</button>
        </div>
      )}
    </section>
  );
}
