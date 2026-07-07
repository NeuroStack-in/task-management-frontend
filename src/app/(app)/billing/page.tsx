import { redirect } from "next/navigation";

// Billing lives inside the Settings hub (gated by `billing:view`); keep the old
// URL working by redirecting there so it can't be reached fail-open.
export default function Page() {
  redirect("/settings/billing");
}
