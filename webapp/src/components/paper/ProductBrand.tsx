// Знак продукта ссылкой на главную — одна шапка-бренд на вход и 2FA (AuthShell), /link и /account/merge
// (MergeSpread), /install (InstallFrame): ревью b26–b28 — на входе знак лежал плиткой на полосе бумаги, а на
// /link, /merge и /install — голым логотипом на фоне страницы. Плитка — бумага оттенка экрана (--h): на
// листе героя (вход) знак уже на бумаге, на фоне страницы бумагу даёт `plate`. Зона 44px по высоте.
import { BrandMark } from '../art/BrandMark';

export function ProductBrand({ plate = false, className }: { plate?: boolean; className?: string }) {
  return (
    <a href="/" className={className ? `pb-brand ${className}` : 'pb-brand'} aria-label="На главную" title="На главную">
      <span className={plate ? 'pb-mark pb-mark--plate' : 'pb-mark'}><BrandMark size={plate ? 30 : 36} /></span>
      <span className="pb-name">Всё по схеме</span>
    </a>
  );
}
