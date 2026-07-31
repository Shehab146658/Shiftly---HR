"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type ServerFormAction = (formData: FormData) => Promise<void>;

function readableError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes("duplicate key")) return "A record with the same code or name already exists.";
  if (error.message.includes("violates check constraint")) return "One or more values are outside the allowed range.";
  if (error.message && !error.message.includes("Server Components render")) return error.message;
  return fallback;
}
export function ActionForm({
  action,
  children,
  className,
  successMessage,
  errorMessage,
  pendingMessage,
  confirmMessage,
  resetOnSuccess = false,
}: {
  action: ServerFormAction;
  children: ReactNode;
  className?: string;
  successMessage: string;
  errorMessage: string;
  pendingMessage: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setPending(true);
    setFeedback(null);
    try {
      await action(new FormData(event.currentTarget));
      if (resetOnSuccess) formRef.current?.reset();
      setFeedback({ type: "success", message: successMessage });
      router.refresh();
    } catch (error) {
      const digest = typeof error === "object" && error && "digest" in error ? String(error.digest) : "";
      if (digest.startsWith("NEXT_REDIRECT")) throw error;
      setFeedback({ type: "error", message: readableError(error, errorMessage) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={action} aria-busy={pending} className={className} onSubmit={submit} ref={formRef}>
      <fieldset className="action-form-fields" disabled={pending}>{children}</fieldset>
      {pending ? <div aria-live="polite" className="action-feedback action-feedback-pending" role="status"><span className="feedback-spinner" />{pendingMessage}</div> : null}
      {feedback ? <div aria-live="polite" className={`action-feedback action-feedback-${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
        <span aria-hidden="true" className="feedback-icon">{feedback.type === "success" ? "✓" : "!"}</span>
        <span>{feedback.message}</span>
        <button aria-label="Dismiss" onClick={() => setFeedback(null)} type="button">×</button>
      </div> : null}
    </form>
  );
}
