import Link from "next/link";
export default function NotFound() {
  return (
    <main className="login-shell">
      <section className="panel login-card">
        <p className="eyebrow">404</p>
        <h1>This item isn&apos;t here.</h1>
        <p className="muted">
          It may have been deleted, or the link may be incorrect.
        </p>
        <Link className="button primary" href="/chains">
          Back to chains
        </Link>
      </section>
    </main>
  );
}
