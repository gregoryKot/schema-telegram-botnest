import { NeedArt } from '../art/NeedArt';

/** Название потребности и её мотив в одной строке: картинка не уводит ответы за сгиб. */
export function NeedTitle({ name, needId }: { name: string; needId?: string }) {
  return (
    <div className="tq-namerow">
      <h1 className="tq-title">{name}</h1>
      {needId && <span className="pp-row-art"><NeedArt id={needId} size="row" /></span>}
    </div>
  );
}
