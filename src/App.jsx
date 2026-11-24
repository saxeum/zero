function App() {
  const [items, setItems] = React.useState([]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/items", { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setItems(await res.json());
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message);
      }
      setLoading(false);
    }

    load();

    return () => controller.abort();
  }, []);

  React.useEffect(() => {
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
      const item = await res.json();
      setItems((prev) => [...prev, item]);
      setDraft("");
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Failed: {error}</p>;

  return (
    <div>
      <input value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button onClick={add}>Add</button>
      <ul>
        {items.map((row) => (
          <li key={row.id}>
            {row.text}
            <button onClick={() => remove(row.id)}>x</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
