import { Redirect } from "expo-router";
import { AuthSplash } from "@/components/AuthSplash";
import { useSession } from "@/providers/SessionProvider";

export default function Index() {
  const { state } = useSession();

  if (state.status === "loading") {
    return <AuthSplash />;
  }

  if (state.status === "signed_in") {
    return <Redirect href="/(tabs)/workbench" />;
  }

  return <Redirect href="/(auth)/start" />;
}
