/**
 * Passthrough — each auth page owns its own layout. The bespoke login/signup
 * fill the viewport; the secondary pages (forgot/mfa/reset) use <AuthShell>.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
