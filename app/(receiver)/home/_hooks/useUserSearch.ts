import { useEffect, useRef, useState } from "react";
import { listAllUsers, searchUsers } from "../_services/users";
import type { RecipientUser } from "../types";

export function useUserSearch() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<RecipientUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<RecipientUser[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    // Sans saisie → liste complète
    if (!query?.trim()) {
      (async () => {
        try {
          setLoadingAll(true);
          if (!allUsers) {
            const raw = await listAllUsers({ pageSize: 100, maxPages: 10, authMode: "userPool" });
            const mapped: RecipientUser[] = raw.map(u => ({
              id: u.id,
              displayName: u.displayName || u.email || "Utilisateur",
              email: u.email,
              defaultAddressLabel: undefined,
            }));
            setAllUsers(mapped);
            setItems(mapped);
          } else {
            setItems(allUsers);
          }
          setOpen(true);
        } catch {
          setItems([]);
          setOpen(false);
        } finally {
          setLoadingAll(false);
        }
      })();
      return () => { if (timer.current) clearTimeout(timer.current); };
    }

    // Avec saisie → recherche filtrée
    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await searchUsers(query);
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
  }, [query, allUsers]);

  return { query, setQuery, items, open, setOpen, loading, loadingAll };
}