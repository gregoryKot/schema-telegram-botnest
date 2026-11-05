import { NeedArt } from './art/NeedArt';

/** Мотив потребности отдельной строкой в теле листа (шапка листа — ds-sheet-head — остаётся без картинок). */
export function NeedArtLine({ id }: { id: string }) {
  return (
    <div className="pp-row-art pp-need-line">
      <NeedArt id={id} size="row" />
    </div>
  );
}
