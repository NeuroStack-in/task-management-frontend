import { redirect } from "next/navigation";

// The settings hub is a two-pane shell (see layout.tsx). The index has no
// content of its own — land on the first account section.
export default function SettingsPage() {
  redirect("/settings/profile");
}
