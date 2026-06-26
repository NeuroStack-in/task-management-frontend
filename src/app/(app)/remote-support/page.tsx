import { redirect } from "next/navigation";

// Remote Support now lives inside the Settings hub; keep the old URL working.
export default function Page() {
  redirect("/settings/remote-support");
}
