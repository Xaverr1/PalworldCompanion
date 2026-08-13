import { useMemo, useState } from "react";
import {
  STRUCTURES,
  BUILD_CATEGORIES,
  structureBySlug,
  type BuildCategory,
  type Structure,
} from "../data/structures";
import { useBuildQueue } from "../hooks/useBuildQueue";
import { aggregateMaterials } from "../lib/build";

/** Hide an icon that fails to load (paldb occasionally 404s an asset). */
const hideBroken = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = "hidden";
};

export function BuildQueue() {
  const { queue, add, setQty, remove, clear } = useBuildQueue();
  const [category, setCategory] = useState<BuildCategory>("Production");
  const [filter, setFilter] = useState("");

  const qtyBySlug = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of queue) m.set(q.slug, q.qty);
    return m;
  }, [queue]);

  const query = filter.trim().toLowerCase();

  // Searching matches every category; otherwise show the active category.
  // Group by subcategory, preserving the pre-sorted STRUCTURES order.
  const groups = useMemo(() => {
    const base = query
      ? STRUCTURES.filter((s) => s.name.toLowerCase().includes(query))
      : STRUCTURES.filter((s) => s.category === category);
    const map = new Map<string, Structure[]>();
    for (const s of base) {
      const key = query ? `${s.category} · ${s.subcategory}` : s.subcategory;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [query, category]);

  const totals = useMemo(() => aggregateMaterials(queue), [queue]);
  const totalStructures = queue.reduce((n, q) => n + q.qty, 0);

  return (
    <div className="build">
      <div className="build__body">
        <section className="build__picker">
          <input
            className="build__search"
            type="search"
            placeholder="Search all structures…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />

          {!query && (
            <div className="build__cats">
              {BUILD_CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={`chip ${c === category ? "chip--on build__cat--on" : ""}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="build__groups">
            {[...groups.entries()].map(([sub, list]) => (
              <div key={sub} className="build__group">
                <h3 className="build__grouptitle">{sub}</h3>
                <div className="build__grid">
                  {list.map((s) => {
                    const qn = qtyBySlug.get(s.slug) ?? 0;
                    return (
                      <button
                        key={s.slug}
                        className={`build__tile ${qn ? "is-queued" : ""}`}
                        onClick={() => add(s.slug)}
                        title={`Add ${s.name}`}
                      >
                        {qn > 0 && <span className="build__tilebadge">{qn}</span>}
                        <img src={s.icon} alt="" loading="lazy" onError={hideBroken} />
                        <span>{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groups.size === 0 && (
              <p className="muted build__empty">
                No structures match “{filter}”.
              </p>
            )}
          </div>
        </section>

        <aside className="build__side">
          <section className="upcard">
            <header className="build__sidehead">
              <h3 className="detail__sub">Build queue</h3>
              {queue.length > 0 && (
                <button className="btn btn--danger" onClick={clear}>
                  Clear
                </button>
              )}
            </header>
            {queue.length === 0 ? (
              <p className="muted">
                Add structures from the left to see the materials you'll need.
              </p>
            ) : (
              <ul className="build__queue">
                {queue.map((q) => {
                  const s = structureBySlug(q.slug);
                  if (!s) return null;
                  return (
                    <li key={q.slug} className="build__qrow">
                      <img src={s.icon} alt="" loading="lazy" onError={hideBroken} />
                      <span className="build__qname">{s.name}</span>
                      <div className="build__stepper">
                        <button
                          onClick={() => setQty(q.slug, q.qty - 1)}
                          aria-label={`One fewer ${s.name}`}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={q.qty}
                          onChange={(e) =>
                            setQty(
                              q.slug,
                              Math.max(0, Math.floor(Number(e.target.value) || 0)),
                            )
                          }
                        />
                        <button
                          onClick={() => setQty(q.slug, q.qty + 1)}
                          aria-label={`One more ${s.name}`}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="build__qremove"
                        onClick={() => remove(q.slug)}
                        aria-label={`Remove ${s.name}`}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="upcard">
            <h3 className="detail__sub">Materials needed</h3>
            {totals.length === 0 ? (
              <p className="muted">—</p>
            ) : (
              <>
                <p className="build__summary">
                  {totalStructures} structure{totalStructures !== 1 ? "s" : ""} ·{" "}
                  {totals.length} material{totals.length !== 1 ? "s" : ""}
                </p>
                <ul className="build__mats">
                  {totals.map((m) => (
                    <li key={m.slug} className="build__mat">
                      {m.icon && (
                        <img src={m.icon} alt="" loading="lazy" onError={hideBroken} />
                      )}
                      <span className="build__matname">{m.name}</span>
                      <b>×{m.total}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
