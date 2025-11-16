import { useEffect, useState } from "react";
import { listAllUsers } from "../services/users";
import type { RecipientUser } from "../types";

export function useUserSearch() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<RecipientUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<RecipientUser[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await listAllUsers({ pageSize: 200, maxPages: 20, authMode: "userPool" });
        if (!active) return;
        const mapped: RecipientUser[] = res.map((u) => ({
          id: u.id,
          displayName: u.displayName || u.email || "Utilisateur",
          email: u.email,
          defaultAddressLabel: (u as any)?.defaultAddressLabel || (u as any)?.address || undefined,
        }));
        console.log("[useUserSearch] utilisateurs chargés:", mapped);
        setAllUsers(mapped);
        setItems(mapped);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setItems(allUsers);
      return;
    }
    const filtered = allUsers.filter((u) => {
      const name = u.displayName?.toLowerCase() ?? "";
      const email = u.email?.toLowerCase() ?? "";
      return name.includes(trimmed) || email.includes(trimmed);
    });
    setItems(filtered);
  }, [query, allUsers]);

  const isEmpty = !loading && allUsers.length === 0;

  return { query, setQuery, items, open, setOpen, loading, isEmpty };
}
