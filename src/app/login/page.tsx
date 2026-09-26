import { PageShell } from "@/components/Tile";
import { Notice } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  return (
    <PageShell title="Staff sign in">
      <div className="max-w-sm space-y-4">
        {reason === "not-staff" && <Notice ok={false}>That login isn&apos;t set up as staff.</Notice>}
        <LoginForm next={next} />
      </div>
    </PageShell>
  );
}
