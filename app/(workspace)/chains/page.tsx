import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { Chain } from "@/lib/types";
import { when } from "@/lib/data";
export default async function Chains({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; notice?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 80);
  let query = supabase
    .from("prompt_chains")
    .select("*, prompt_chain_steps(count)")
    .order("updated_at", { ascending: false });
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, error } =
    await query.returns<
      (Chain & { prompt_chain_steps: { count: number }[] })[]
    >();
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Prompt chains</h1>
          <p className="muted">
            Small steps. Better outputs. Build a workflow you can run again.
          </p>
        </div>
        <Link className="button primary" href="/chains/new">
          ＋ New chain
        </Link>
      </header>
      {params.notice === "deleted" && (
        <p role="status" className="notice success">
          Chain deleted. Saved runs are still available in Generated media.
        </p>
      )}
      <div className="list-toolbar">
        <form method="get" className="search">
          <input
            aria-label="Search chains"
            name="q"
            defaultValue={q}
            placeholder="Search prompt chains…"
          />
          <button className="button">Search</button>
        </form>
        <span className="muted">{data?.length ?? 0} workflows</span>
      </div>
      {error ? (
        <p className="notice error" role="alert">
          Prompt chains could not be loaded. Please refresh.
        </p>
      ) : data?.length ? (
        <div className="chain-grid">
          {data.map((chain) => (
            <Link
              className="panel chain-card"
              href={`/chains/${chain.id}`}
              key={chain.id}
            >
              <div className="row between">
                <span className="chain-icon">⌘</span>
                <span className={`badge ${chain.is_active ? "green" : ""}`}>
                  {chain.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <h2>{chain.name}</h2>
              <p className="muted clamp">
                {chain.description || "No description yet."}
              </p>
              <div className="card-footer">
                <span>{chain.prompt_chain_steps[0]?.count ?? 0} steps</span>
                <span>Open chain →</span>
              </div>
              <small className="muted">
                Updated {when(chain.updated_at)} ET
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel empty">
          <span className="empty-symbol">⌘</span>
          <h2>
            {q ? "No matching chains" : "Your next workflow starts here."}
          </h2>
          <p className="muted">
            {q
              ? "Try a different name."
              : "Create a chain, add a few steps, and run it with your input."}
          </p>
          <Link className="button primary" href={q ? "/chains" : "/chains/new"}>
            {q ? "Clear search" : "Create your first chain"}
          </Link>
        </div>
      )}
    </>
  );
}
