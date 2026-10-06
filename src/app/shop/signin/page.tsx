import { redirect } from "next/navigation";
import { Card, Notice } from "@/components/ui";
import { getShopViewer } from "@/lib/auth";
import type { ShopKind } from "@/lib/shop";
import { ShopShell } from "../ShopShell";
import { SignInForm, SignUpForm } from "./SignInForms";

export default async function ShopSignIn(props: PageProps<"/shop/signin">) {
  const params = await props.searchParams;
  const kind: ShopKind = params.kind === "retail" ? "retail" : "wholesale";
  const next = typeof params.next === "string" ? params.next : undefined;
  const { customer } = await getShopViewer();
  if (customer) redirect(next?.startsWith("/shop") ? next : "/shop/account");

  return (
    <ShopShell kind={kind} title="Sign in or create an account">
      {params.reason === "link" && <Notice ok={false}>That link didn&apos;t work or has expired. Sign in, or create the account again.</Notice>}
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-4 !p-6">
          <h2 className="!m-0 !text-[26px]">Sign in</h2>
          <SignInForm next={next} />
        </Card>
        <Card className="flex flex-col gap-4 !p-6">
          <h2 id="create" className="!m-0 !text-[26px]">
            New here? Create an account
          </h2>
          <SignUpForm kind={kind} next={next} />
        </Card>
      </div>
    </ShopShell>
  );
}
