// Единый путь «канвас → PNG → системный шэр» для всех share-карточек
// (оба фронтенда). Каскад фолбэков: share с файлом → share текстом →
// (опционально) скачивание. Если ничего не сработало — бросает ошибку:
// вызывающий показывает свой текстовый фолбэк (клипборд/шит).

export async function shareCanvasImage(
  canvas: HTMLCanvasElement,
  text: string,
  filename: string,
  opts: { downloadFallback?: boolean } = {},
): Promise<'shared' | 'downloaded'> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas empty'))),
      'image/png',
    );
  });
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text });
    return 'shared';
  }
  if (navigator.share) {
    await navigator.share({ text });
    return 'shared';
  }
  if (opts.downloadFallback) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }
  throw new Error('share unavailable');
}
