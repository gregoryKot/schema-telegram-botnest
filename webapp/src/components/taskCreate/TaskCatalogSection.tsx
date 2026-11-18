// «Из справочника» в листе «Новое задание» (TaskCreateSheet, только терапевту): текстовые задания без экрана в
// приложении — их можно дать и клиенту без аккаунта. Данные — shared/tasks/catalog (пункты «Между сессиями»
// справочника); «Взять» отдаёт листу текст «Своего задания», дальше его можно дописать.
import { useMemo, useState } from 'react';
import { haptic } from '../../haptic';
import { useGuide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import { pickForm, useAddressForm } from '../../utils/addressForm';
import {
  buildTaskCatalog, catalogTaskWhen, customTaskText, searchTaskCatalog, type CatalogTask,
} from '../../../../shared/src/tasks/catalog/taskCatalog';

function CatalogRow({ task, open, onToggle, onTake }: { task: CatalogTask; open: boolean; onToggle: () => void; onTake: () => void }) {
  return (
    <li className="sk-cat-item">
      <button
        type="button" aria-expanded={open} onClick={onToggle}
        className={'ds-list-row ds-list-row--nav ds-list-row--hover ds-list-row--inset sk-cat-row' + (open ? ' is-open' : '')}
      >
        <span className="ds-list-title">{task.title}</span>
        <span className="ds-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="sk-cat-body">
          <div className="ds-label">Что делать</div>
          <p className="sk-cat-text">{task.text}</p>
          <div className="ds-label">Когда давать</div>
          <p className="sk-cat-text">{catalogTaskWhen(task).join(', ')}</p>
          <button type="button" className="ds-btn ds-btn--secondary sk-cat-take" onClick={onTake}>Взять</button>
        </div>
      )}
    </li>
  );
}

export function TaskCatalogSection({ onTake }: { onTake: (text: string) => void }) {
  const form = useAddressForm();
  const texts = useGuide();
  const catalog = useMemo(
    () => (texts ? buildTaskCatalog(texts, (ty, vy) => pickForm(form, ty, vy)) : []),
    [texts, form],
  );
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = searchTaskCatalog(catalog, query);
  const empty = texts === undefined
    ? <div className="ds-sub" role="status">Загружаем справочник…</div>
    : texts === null
      ? <p className="ds-empty" role="status">Справочник не загрузился — задания появятся после перезагрузки страницы.</p>
      : <p className="ds-empty">Ничего не нашлось</p>;

  return (
    <section className="sk-field sk-cat" aria-label="Задания из справочника">
      <div className="ds-label">Из справочника</div>
      <p className="ds-sub sk-cat-lead">
        Задания из «Между сессиями» справочника: клиент делает их без приложения. «Взять» подставит текст в «Своё задание» — его можно дописать.
      </p>
      <input
        type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80}
        placeholder="Найти по названию" aria-label="Найти задание в справочнике" className="ds-input ds-input--search"
      />
      {groups.length === 0 && empty}
      {groups.map((group) => (
        <div key={group.id} className="sk-cat-group">
          <div className="ds-sub sk-cat-group-title">{group.title}</div>
          <ul className="sk-cat-list">
            {group.items.map((task) => (
              <CatalogRow
                key={task.id} task={task} open={openId === task.id}
                onToggle={() => { haptic.select(); setOpenId(openId === task.id ? null : task.id); }}
                onTake={() => { haptic.select(); setOpenId(null); onTake(customTaskText(task)); }}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
