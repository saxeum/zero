import { useEffect, useState, type FormEvent } from "react";
import { CreateItemResponse, ListItemsResponse } from "../shared/generated/api.ts";
import type { Item } from "../shared/generated/models.ts";
import { signOut } from "./auth-client";

function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/items", { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setItems(ListItemsResponse.parse(await res.json()));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof Error ? err.message : String(err));
      }
      setLoading(false);
    }

    load();

    return () => controller.abort();
  }, []);

  /** Returns true when the server accepted the item, so the caller can clear its input. */
  async function add(text: string) {
    if (adding) return false;
    setAdding(true);
    setActionError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const item = CreateItemResponse.parse(await res.json());
      setItems((prev) => [...prev, item]);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setActionError(null);
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  return { items, loading, loadError, actionError, adding, add, remove };
}

export function Items({ email }: { email: string }) {
  const { items, loading, loadError, actionError, adding, add, remove } = useItems();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = `Todos: ${items.length}`;
  }, [items]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (await add(text)) setDraft("");
  };

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter((item) => item.text.toLowerCase().includes(needle))
    : items;

  if (loading) return <p className="muted">Loading…</p>;
  if (loadError) return <p className="error">Failed to load: {loadError}</p>;

  return (
    <main>
      <header className="header">
        <h1>Todos</h1>
        <div className="account">
          <span className="email" title={email}>
            {email}
          </span>
          <button className="signout" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <form className="add" onSubmit={submit}>
        <label className="sr-only" htmlFor="new-item">
          New item
        </label>
        <input
          id="new-item"
          value={draft}
          placeholder="What needs doing?"
          autoComplete="off"
          autoFocus
          enterKeyHint="done"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}

      {items.length > 0 && (
        <div className="toolbar">
          <label className="sr-only" htmlFor="filter">
            Filter items
          </label>
          <input
            id="filter"
            type="search"
            placeholder="Filter…"
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="count">
            {visible.length === items.length
              ? `${items.length} ${items.length === 1 ? "item" : "items"}`
              : `${visible.length} of ${items.length}`}
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="empty">Nothing here yet — add your first item above.</p>
      ) : (
        <>
          <ul>
            {visible.map((row) => (
              <li key={row.id}>
                <span className="text">{row.text}</span>
                <button
                  className="remove"
                  aria-label={`Remove ${row.text}`}
                  onClick={() => remove(row.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {visible.length === 0 && <p className="empty">No matches for “{query.trim()}”.</p>}
        </>
      )}
    </main>
  );
}
