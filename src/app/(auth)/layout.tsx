/**
 * All six auth surfaces (login · register · forgot · reset · mfa · accept-invite) share one
 * split-screen frame, so the stylesheets load here rather than per page.
 *
 * `marketing.css` supplies the `.m-root` "Harbor" teal tokens plus the button/input base; `auth.css`
 * owns the split itself. Previously only login and register imported the theme and the other four
 * rendered as light app-token cards — so resetting your password visibly left the design system
 * halfway through the flow.
 */
import "@/app/marketing.css";
import "@/app/auth.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
