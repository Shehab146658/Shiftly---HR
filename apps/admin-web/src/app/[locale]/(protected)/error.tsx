"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const locale = pathname.split("/")[1] === "ar" ? "ar" : "en";
  const arabic = locale === "ar";

  useEffect(() => {
    console.error("Protected route failed", error);
  }, [error]);

  return (
    <section className="route-error" role="alert">
      <div aria-hidden="true" className="route-error-mark">!</div>
      <div className="route-error-copy">
        <span className="eyebrow">{arabic ? "تعذر تحميل الصفحة" : "We hit a temporary problem"}</span>
        <h1>{arabic ? "لم نتمكن من إكمال هذه العملية" : "This workspace could not be loaded"}</h1>
        <p>
          {arabic
            ? "بياناتك آمنة. حاول مرة أخرى، أو ارجع إلى لوحة التحكم لمتابعة عملك."
            : "Your data is safe. Try the page again, or return to the dashboard and continue working."}
        </p>
        <div className="route-error-actions">
          <button className="button primary" onClick={reset} type="button">
            {arabic ? "المحاولة مرة أخرى" : "Try again"}
          </button>
          <Link className="button secondary" href={`/${locale}/dashboard`}>
            {arabic ? "العودة للوحة التحكم" : "Back to dashboard"}
          </Link>
        </div>
        {error.digest ? (
          <small>{arabic ? "مرجع الدعم" : "Support reference"}: {error.digest}</small>
        ) : null}
      </div>
    </section>
  );
}
