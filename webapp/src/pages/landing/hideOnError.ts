// onError для фото визитки: сломанную картинку скрываем, чтобы не торчал
// значок битого файла (под ней уже лежит запасная буква или фон).
export const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none';
};
