import { redirect } from "next/navigation";

// Integrations now lives inside the Settings hub; keep the old URL working.
export default function Page() {
  redirect("/settings/integrations");
}
