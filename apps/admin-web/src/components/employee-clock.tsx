"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Punch = {
  id: string;
  punch_type: "check_in" | "check_out";
  occurred_at: string;
  validation_status: "valid" | "pending" | "rejected";
  within_geofence: boolean | null;
  distance_metres: number | null;
  source: string;
};

type ScheduleEntry = {
  id: string;
  entryType: string;
  start: string | null;
  end: string | null;
  endDayOffset: number;
  branchName: string | null;
};

type ClockCopy = {
  title: string;
  checkIn: string;
  checkOut: string;
  branch: string;
  todayShift: string;
  noShift: string;
  mobileDisabled: string;
  selfie: string;
  selfieRequired: string;
  selfieOptional: string;
  takeSelfie: string;
  replaceSelfie: string;
  location: string;
  locationReady: string;
  locationOnSubmit: string;
  locationUnavailable: string;
  radius: string;
  online: string;
  offline: string;
  submitting: string;
  recorded: string;
  pending: string;
  failed: string;
  recent: string;
  noPunches: string;
  valid: string;
  rejected: string;
  meters: string;
  remove: string;
};

export function EmployeeClock({
  locale,
  initialNow,
  tenantId,
  employeeId,
  branchId,
  branchName,
  mobileClockEnabled,
  selfieRequired,
  geofenceConfigured,
  geofenceRadiusMetres,
  schedule,
  initialPunches,
  copy,
}: {
  locale: "en" | "ar";
  initialNow: string;
  tenantId: string;
  employeeId: string;
  branchId: string;
  branchName: string;
  mobileClockEnabled: boolean;
  selfieRequired: boolean;
  geofenceConfigured: boolean;
  geofenceRadiusMetres: number;
  schedule: ScheduleEntry[];
  initialPunches: Punch[];
  copy: ClockCopy;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(initialNow));
  const [punches, setPunches] = useState(initialPunches);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: "success" | "warning" | "error"; text: string } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const syncOnline = () => setOnline(navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const lastAcceptedPunch = useMemo(
    () => punches.find((punch) => punch.validation_status !== "rejected"),
    [punches],
  );
  const punchType: "check_in" | "check_out" = lastAcceptedPunch?.punch_type === "check_in" ? "check_out" : "check_in";
  const actionLabel = punchType === "check_in" ? copy.checkIn : copy.checkOut;

  function locate(): Promise<GeolocationCoordinates | null> {
    if (!("geolocation" in navigator)) return Promise.resolve(null);
    return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    ));
  }

  function selectSelfie(file: File | null) {
    setSelfie(file);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function submitPunch() {
    if (busy || !online || !mobileClockEnabled) return;
    if (selfieRequired && !selfie) {
      setFeedback({ kind: "error", text: copy.selfieRequired });
      return;
    }

    setBusy(true);
    setFeedback(null);
    const client = createSupabaseBrowserClient();
    let selfiePath: string | null = null;
    try {
      const coordinates = await locate();
      if (selfie) {
        const extension = ({ "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" } as Record<string, string>)[selfie.type] ?? "jpg";
        selfiePath = `${tenantId}/${employeeId}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage.from("attendance-selfies").upload(selfiePath, selfie, {
          cacheControl: "3600",
          contentType: selfie.type || "image/jpeg",
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }

      const occurredAt = new Date().toISOString();
      const { data: punchId, error: punchError } = await client.rpc("record_attendance_punch", {
        p_employee_id: employeeId,
        p_punch_type: punchType,
        p_occurred_at: occurredAt,
        p_source: "mobile",
        p_work_date: null,
        p_branch_id: branchId,
        p_latitude: coordinates?.latitude ?? null,
        p_longitude: coordinates?.longitude ?? null,
        p_selfie_path: selfiePath,
        p_device_identifier: `web:${navigator.userAgent.slice(0, 180)}`,
        p_external_reference: null,
        p_notes: coordinates ? null : copy.locationUnavailable,
      });
      if (punchError) throw punchError;

      const { data: saved, error: savedError } = await client
        .from("attendance_punches")
        .select("id,punch_type,occurred_at,validation_status,within_geofence,distance_metres,source")
        .eq("id", punchId)
        .single();
      if (savedError) throw savedError;
      const newPunch = saved as Punch;
      setPunches((current) => [newPunch, ...current].slice(0, 8));
      selectSelfie(null);
      setFeedback({
        kind: newPunch.validation_status === "pending" ? "warning" : "success",
        text: newPunch.validation_status === "pending" ? copy.pending : `${actionLabel} ${copy.recorded}`,
      });
      router.refresh();
    } catch (error) {
      if (selfiePath) await client.storage.from("attendance-selfies").remove([selfiePath]);
      const detail = error instanceof Error ? error.message : String(error);
      setFeedback({ kind: "error", text: `${copy.failed} ${detail}` });
    } finally {
      setBusy(false);
    }
  }

  const formattedTime = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now);
  const formattedDate = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { weekday: "long", day: "numeric", month: "long" }).format(now);

  return <div className="employee-clock-layout">
    <section className="card clock-console">
      <div className="clock-console-head"><div><span className={`connection-state ${online ? "online" : "offline"}`}><i />{online ? copy.online : copy.offline}</span><h2>{formattedTime}</h2><p>{formattedDate}</p></div><span className="clock-branch-badge">{branchName}</span></div>
      {!mobileClockEnabled ? <div className="clock-policy-warning">{copy.mobileDisabled}</div> : null}
      <div className="clock-action-orbit"><button aria-busy={busy} className={`clock-action clock-action-${punchType}`} disabled={busy || !online || !mobileClockEnabled} onClick={submitPunch} type="button"><span>{busy ? <i className="clock-button-spinner" /> : punchType === "check_in" ? "→" : "←"}</span><strong>{busy ? copy.submitting : actionLabel}</strong><small>{copy.locationOnSubmit}</small></button></div>
      {feedback ? <div aria-live="polite" className={`clock-feedback clock-feedback-${feedback.kind}`}>{feedback.text}</div> : null}
      <div className="clock-evidence-grid">
        <div className="clock-evidence-card"><span>{copy.location}</span><strong>{geofenceConfigured ? copy.locationOnSubmit : copy.locationUnavailable}</strong><small>{geofenceConfigured ? `${copy.radius}: ${geofenceRadiusMetres} ${copy.meters}` : copy.pending}</small></div>
        <div className="clock-evidence-card selfie-card"><span>{copy.selfie}</span>{preview ? <Image alt={copy.selfie} height={72} src={preview} unoptimized width={72} /> : <strong>{selfieRequired ? copy.selfieRequired : copy.selfieOptional}</strong>}<div><label className="button secondary small-button" htmlFor="attendance-selfie">{preview ? copy.replaceSelfie : copy.takeSelfie}</label>{preview ? <button className="text-button danger-text" onClick={() => selectSelfie(null)} type="button">{copy.remove}</button> : null}</div><input accept="image/*" capture="user" id="attendance-selfie" onChange={(event) => selectSelfie(event.target.files?.[0] ?? null)} type="file" /></div>
      </div>
    </section>

    <aside className="clock-side-stack">
      <section className="card clock-shift-card"><div className="card-heading"><h2>{copy.todayShift}</h2><span className="badge">{schedule.length}</span></div>{schedule.length ? <div className="clock-shift-list">{schedule.map((entry) => <div key={entry.id}><span>{entry.entryType.replaceAll("_", " ")}</span><strong>{entry.start && entry.end ? `${entry.start.slice(0, 5)} – ${entry.end.slice(0, 5)}${entry.endDayOffset ? " +1" : ""}` : entry.entryType.toUpperCase()}</strong><small>{entry.branchName ?? branchName}</small></div>)}</div> : <div className="empty compact-empty">{copy.noShift}</div>}</section>
      <section className="card clock-history-card"><div className="card-heading"><h2>{copy.recent}</h2><span className="badge">{punches.length}</span></div><div className="clock-punch-list">{punches.map((punch) => <div key={punch.id}><span className={`clock-punch-icon clock-punch-${punch.punch_type}`}>{punch.punch_type === "check_in" ? "→" : "←"}</span><div><strong>{punch.punch_type === "check_in" ? copy.checkIn : copy.checkOut}</strong><small>{new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(punch.occurred_at))}</small></div><span className={`badge attendance-${punch.validation_status}`}>{punch.validation_status === "valid" ? copy.valid : punch.validation_status === "pending" ? copy.pending : copy.rejected}</span></div>)}{!punches.length ? <div className="empty compact-empty">{copy.noPunches}</div> : null}</div></section>
    </aside>
  </div>;
}
