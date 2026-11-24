import { useEffect, useState } from "react";

export type Item = { id: string; text: string };

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
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

  /** Returns true when the server accepted the item, so the caller can clear its input. */
  async function add(text: string) {
    setActionError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const item: Item = await res.json();
      setItems((prev) => [...prev, item]);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      return false;
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

  return { items, loading, loadError, actionError, add, remove };
}
