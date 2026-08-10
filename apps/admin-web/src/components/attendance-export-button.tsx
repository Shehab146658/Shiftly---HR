"use client";

export function AttendanceExportButton({ rows, filename, label }: { rows: string[][]; filename: string; label: string }) {
  function download() {
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  return <button className="button ghost" onClick={download} type="button">{label}</button>;
}

