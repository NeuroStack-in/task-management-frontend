import { redirect } from "next/navigation";

// The settings hub is a two-pane shell (see layout.tsx). The index has no
// content of its own — redirect to the first account section (Profile).
// Server-side redirect() resolves before render, so there's no client loader
// and no dropped navigation when arriving from a sidebar click.
export default function SettingsPage() {
  redirect("/settings/profile");
}
