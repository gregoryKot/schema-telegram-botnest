import { NeedArt } from '../../components/art/NeedArt';

// Мокап приложения на первом экране лендинга — вынесен из
// ProductLandingPage.tsx (правило №10: файл сверх потолка растёт только
// дроблением). Данные декоративные (aria-hidden), не пользовательские.
// Вид — бумага кабинета (styles/product-landing.css, .pl2-phone): знаки
// потребностей те же, что в трекере (NeedArt), заметки лежат неподвижно.
const MOCK_NEEDS = [
  { id: 'attachment', name: 'Привязанность', v: 7, c: 'var(--c-teal)' },
  { id: 'autonomy',   name: 'Автономия',     v: 8, c: 'var(--c-moss)' },
  { id: 'limits',     name: 'Границы',       v: 4, c: 'var(--c-rose)' },
  { id: 'play',       name: 'Спонтанность',  v: 6, c: 'var(--c-amber)' },
];
const MOCK_SPARK = [4, 5, 3, 6, 5, 7, 6, 8, 7, 8, 6, 9];

export function AppPreview() {
  return (
    <div className="pl2-preview" aria-hidden>
      <div className="pl2-phone">
        <div className="pl2-phone-title">Сегодня</div>
        <p className="pl2-phone-sub">Пять потребностей — минутный <span className="pl2-nowrap">чек-ин</span></p>
        {MOCK_NEEDS.map((n) => (
          <div key={n.id} className="pl2-need">
            <div className="pl2-need-row">
              <NeedArt id={n.id} size="row" />
              <span>{n.name}</span>
              <span className="pl2-need-v">{n.v}</span>
            </div>
            <div className="pl2-track"><span style={{ width: `${n.v * 10}%`, background: n.c }} /></div>
          </div>
        ))}
        <div className="pl2-spark">
          <div className="pl2-spark-head"><b>Динамика</b><span>2 недели</span></div>
          <svg width="100%" height="42" viewBox="0 0 220 42" preserveAspectRatio="none">
            {MOCK_SPARK.map((v, i) => (
              <rect key={i} x={i * 18.5} y={42 - v * 4.2} width="11" height={v * 4.2} rx="3" fill="var(--c-moss)" opacity={0.35 + (v / 9) * 0.65} />
            ))}
          </svg>
        </div>
      </div>
      <div className="pl2-note-card pl2-note-card--a">
        Схема замечена
        <small>Покинутость · 3-й раз за неделю</small>
      </div>
      <div className="pl2-note-card pl2-note-card--b">
        Критик — тише
        <small>реже, чем месяц назад</small>
      </div>
    </div>
  );
}
