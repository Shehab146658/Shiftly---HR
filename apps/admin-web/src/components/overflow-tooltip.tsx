export function OverflowTooltip({ text, className = "" }: { text: string; className?: string }) {
  return <span className={`overflow-tooltip ${className}`.trim()} tabIndex={0} title={text}><span className="overflow-tooltip-text">{text}</span><span aria-hidden="true" className="overflow-tooltip-bubble" role="tooltip">{text}</span></span>;
}
