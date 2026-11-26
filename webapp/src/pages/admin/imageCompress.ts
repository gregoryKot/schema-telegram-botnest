// Resize + JPEG-compress an image file to a data URI in the browser, lowering
// quality until it fits the byte budget. Used for the hero photo and article
// images so the payload stays well under the API body limit and persists in the
// DB (Amvera's filesystem is ephemeral, so we can't rely on uploaded files).
export async function compressImage(file: File, maxWidth = 1400, maxBytes = 200 * 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas не поддерживается');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.85;
  let dataUri = canvas.toDataURL('image/jpeg', quality);
  while (dataUri.length > maxBytes && quality > 0.3) {
    quality -= 0.1;
    dataUri = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUri.length > maxBytes) throw new Error('Не удалось сжать изображение до нужного размера');
  return dataUri;
}
