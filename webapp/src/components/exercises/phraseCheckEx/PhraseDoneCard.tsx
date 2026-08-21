// Экран «готово»: было → стало, рядом дословно. Вёрстка — по образцу
// .done-card из BeliefCheckEx (единый визуальный язык done-экранов упражнений
// webapp), только с двумя цитатами вместо таблицы доказательств.
export function PhraseDoneCard({
  phrase,
  rewrite,
}: {
  phrase: string;
  rewrite: string;
}) {
  const trimmedRewrite = rewrite.trim();
  return (
    <div className="done-card">
      <div className="dlabel" style={{ color: 'var(--c-rose)', marginTop: 0 }}>
        Было
      </div>
      <div className="belief-line">«{phrase}»</div>
      {trimmedRewrite && (
        <>
          <div className="dlabel" style={{ color: 'var(--c-moss)' }}>
            Стало
          </div>
          <div className="reframe-line" style={{ color: 'var(--c-moss)' }}>
            «{trimmedRewrite}»
          </div>
        </>
      )}
    </div>
  );
}
