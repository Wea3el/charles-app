import { PageShell } from "@/components/ui";

// Phase 4: today's stops in order, tap for directions, status buttons,
// acting manager signature for unpaid bills, empties credit.
export default function DriverView() {
  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-6 pb-10">
      <PageShell title="Today's route" lead="Your stops will appear here once the trip is planned." />
    </main>
  );
}
