import { useEffect, useState } from "react";
import { getOrCreateProfile } from "./api";

export function useProfileGate() {
  const [state, setState] = useState<"loading"|"needsOnboarding"|"ok">("loading");

  useEffect(() => {
    (async () => {
      try {
        const me = await getOrCreateProfile();
        const hasCore = Boolean(me.first_name && me.last_name && me.address);
        const kycOk = me.kyc_status === "verified" || me.kyc_status === "registered";
        setState(hasCore && kycOk ? "ok" : "needsOnboarding");
      } catch {
        setState("needsOnboarding");
      }
    })();
  }, []);

  return state;
}
