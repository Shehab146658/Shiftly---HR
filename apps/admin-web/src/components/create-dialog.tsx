"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function CreateDialog({
  triggerLabel,
  title,
  description,
  eyebrow,
  closeLabel,
  children,
  triggerClassName = "button button-with-icon",
  width = "wide",
}: {
  triggerLabel: string;
  title: string;
  description?: string;
  eyebrow?: string;
  closeLabel: string;
  children: ReactNode;
  triggerClassName?: string;
  width?: "medium" | "wide";
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.classList.add("modal-open");

    const focusable = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => element.offsetParent !== null);
    window.requestAnimationFrame(() => focusable()[0]?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => trigger?.focus());
    };
  }, [open]);

  return <>
    <button className={triggerClassName} onClick={() => setOpen(true)} ref={triggerRef} type="button">
      <span aria-hidden="true">＋</span>{triggerLabel}
    </button>
    {open ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section aria-labelledby={titleId} aria-modal="true" className={`modal-panel create-modal create-modal-${width}`} ref={panelRef} role="dialog">
        <div className="modal-head">
          <div>{eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}<h2 id={titleId}>{title}</h2>{description ? <p>{description}</p> : null}</div>
          <button aria-label={closeLabel} className="modal-close" onClick={() => setOpen(false)} type="button">×</button>
        </div>
        <div className="create-modal-body">{children}</div>
      </section>
    </div> : null}
  </>;
}
