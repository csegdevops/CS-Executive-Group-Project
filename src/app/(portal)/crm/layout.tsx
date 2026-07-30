// Every page under /crm/* is now just a redirect() shim to its new
// /recruitment/* home — real module gating happens there, not here.
export default function CrmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
