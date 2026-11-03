"use client";
import Link from "next/link";
export default function WorkspaceError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section className="panel empty">
      <h1>We couldn&apos;t load this page.</h1>
      <p className="muted">
        Please try again. If the problem continues, check the database setup.
      </p>
      <div className="row">
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <Link className="button" href="/chains">
          Back to chains
        </Link>
      </div>
    </section>
  );
}
