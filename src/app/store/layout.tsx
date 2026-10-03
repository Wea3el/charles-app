import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui";
import { StoreTitle } from "./StoreTitle";

export default async function StoreLayout({ children }: LayoutProps<"/store">) {
  const staff = await requireStaff();
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex min-h-[60px] items-center gap-3 border-b border-(--color-divider) px-5 py-3">
        <StoreTitle />
        <div className="flex items-center gap-2 text-[13px] text-(--color-neutral-700)">
          <span>{staff.full_name}</span>
          <form action={signOut}>
            <Button variant="ghost">Sign out</Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-5 pt-6 pb-10">{children}</main>
    </div>
  );
}
