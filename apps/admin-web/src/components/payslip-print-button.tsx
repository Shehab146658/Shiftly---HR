"use client";

export function PayslipPrintButton({ label }: { label: string }) {
  return <button className="button" onClick={() => window.print()} type="button">{label}</button>;
}
