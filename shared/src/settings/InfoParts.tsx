import type { InfoPart } from './infoTexts';

// Куски абзаца объясняющего листа настроек (см. infoTexts.ts): строка — как
// есть, { b } — жирным. Класс жирного задаёт фронтенд (цвет у каждого свой).
export function InfoParts({
  parts,
  boldClassName,
}: {
  parts: InfoPart[];
  boldClassName?: string;
}) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <b key={i} className={boldClassName}>
            {part.b}
          </b>
        ),
      )}
    </>
  );
}
