import { useEffect, useState, type FormEvent } from "react";
import { useItems } from "./useItems";

export function App() {
  const { items, loading, loadError, actionError, add, remove } = useItems();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = `Items: ${items.length}`;
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

  if (loading) return <p>Loading…</p>;
  if (loadError) return <p>Failed to load: {loadError}</p>;

  return (
    <div>
      <h1>items</h1>
      <form onSubmit={submit}>
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
        spellCheck={false}
        autoComplete="off"
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
