import { useEffect, useState } from "react";

type Item = { id: string; text: string };

export function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/items", { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setItems(await res.json());
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Failed: {error}</p>;

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
      <ul>
        {items.map((row) => (
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
    </div>
  );
}
