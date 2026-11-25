import { useEffect, useState } from "react";
import { CreateItemResponse, ListItemsResponse } from "../shared/generated/api.ts";
import type { Item } from "../shared/generated/models.ts";

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // 401 is not an error: it is the normal answer when nobody is signed in, so it gets
  // its own state instead of the error banner.
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/items", { signal: controller.signal });
        if (res.status === 401) {
          // Also stop loading: a 401 is a final answer, and returning without this
          // leaves the page on "Loading…" forever.
          setUnauthorized(true);
          setLoading(false);
          return;
        }
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
    setActionError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 401) {
        setUnauthorized(true);
        return false;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const item = CreateItemResponse.parse(await res.json());
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
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  return { items, loading, loadError, actionError, unauthorized, add, remove };
}
