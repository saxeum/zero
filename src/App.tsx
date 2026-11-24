import { useEffect, useState } from "react";

type Item = { id: string; text: string };

export function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/items", { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setItems(await res.json());
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof Error ? err.message : String(err));
      }
      setLoading(false);
    }

    load();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    document.title = `Items: ${items.length}`;
  }, [items]);

  const add = async () => {
    if (!draft.trim()) return;
    setActionError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const item: Item = await res.json();
      setItems((prev) => [...prev, item]);
      setDraft("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (id: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter((item) => item.text.toLowerCase().includes(needle))
    : items;

  if (loading) return <p>Loading…</p>;
  if (loadError) return <p>Failed to load: {loadError}</p>;

  return (
    <div>
      <h1>items</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      <input
        className="filter"
        aria-label="filter items"
        placeholder="filter"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul>
        {visible.map((row) => (
          <li key={row.id}>
            {row.text}
            <button
              aria-label={`remove ${row.text}`}
              onClick={() => remove(row.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {needle && visible.length === 0 && <p className="muted">no matches</p>}
    </div>
  );
}
