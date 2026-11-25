import { useEffect, useState, type FormEvent } from "react";
import { useItems } from "./useItems";
import { signOut, useSession } from "./auth-client";
import { SignIn } from "./SignIn";

export function App() {
  const session = useSession();

  if (session.isPending) return <p className="muted">Loading…</p>;
  // Gate on the session rather than reacting to a 401 from the list: the list should
  // never be asked for without one.
  if (!session.data) return <SignIn />;

  return <Items email={session.data.user.email} />;
}

function Items({ email }: { email: string }) {
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
