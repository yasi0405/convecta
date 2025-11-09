import { useEffect, useRef, useState } from "react";
import { searchUsers } from "../services/users";
import type { RecipientUser } from "../types";

export const MIN_USER_SEARCH_CHARS = 3;

export function useUserSearch() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<RecipientUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < MIN_USER_SEARCH_CHARS) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      return () => {
        if (timer.current) clearTimeout(timer.current);
      };
    }

    // Avec saisie → recherche filtrée
    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await searchUsers(trimmed);
        setItems(res);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const needsMoreChars = Boolean(query.trim()) && query.trim().length < MIN_USER_SEARCH_CHARS;

  return { query, setQuery, items, open, setOpen, loading, needsMoreChars };
}
