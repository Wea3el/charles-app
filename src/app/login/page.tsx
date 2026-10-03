import { PageShell } from "@/components/ui";
import { Notice } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-6 pb-10">
      <PageShell title="Staff sign in">
        <div className="flex max-w-sm flex-col gap-4">
          {reason === "not-staff" && <Notice ok={false}>That login isn&apos;t set up as staff.</Notice>}
          <LoginForm next={next} />
        </div>
      </PageShell>
    </main>
  );
}
