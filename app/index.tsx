import { Redirect } from "expo-router";
import { useProfileGate } from "@/features/user/useProfileGate";
import { ensureAmplifyConfigured } from "@/lib/amplify";

ensureAmplifyConfigured();

export default function RootIndex() {
  const gate = useProfileGate();

  if (gate === "loading") return null;
  if (gate === "needsOnboarding") {
    return <Redirect href="/home/onboarding" />;
  }
  return <Redirect href="/(receiver)/home" />;
}
