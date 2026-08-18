import Link from "next/link";

export type InsightBar = {
  label: string;
  value: number;
  displayValue?: string;
  color?: string;
  href?: string;
};

export function InsightBars({
  title,
  subtitle,
  items,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  items: InsightBar[];
  emptyLabel?: string;
}) {
  const maximum = Math.max(1, ...items.map((item) => item.value));
  return <article className="card insight-panel">
    <div className="card-heading"><div><h2>{title}</h2><p className="muted">{subtitle}</p></div></div>
    <div className="insight-bars">
      {!items.length && emptyLabel ? <div className="empty insight-empty">{emptyLabel}</div> : null}
      {items.map((item) => {
        const content = <>
          <div className="insight-bar-label"><span>{item.label}</span><strong>{item.displayValue ?? item.value}</strong></div>
          <span aria-hidden="true" className="insight-bar-track"><i style={{ background: item.color ?? "#4969d5", width: `${Math.max(item.value ? 5 : 0, item.value / maximum * 100)}%` }} /></span>
        </>;
        return item.href
          ? <Link className="insight-bar-row" href={item.href} key={item.label}>{content}</Link>
          : <div className="insight-bar-row" key={item.label}>{content}</div>;
      })}
    </div>
  </article>;
}
