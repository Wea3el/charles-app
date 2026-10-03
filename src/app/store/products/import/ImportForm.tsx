"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Button, Field, Textarea } from "@/components/ui";
import { parseProductCsv } from "@/lib/productImport";
import { importProducts } from "../actions";

export function ImportForm() {
  const [csv, setCsv] = useState("");
  const preview = csv.trim() ? parseProductCsv(csv) : null;

  return (
    <ActionForm action={importProducts} className="flex flex-col gap-4">
      {(pending) => (
        <>
          <Field label="CSV file" hint="In Excel or Google Sheets: File > Save as / Download > CSV.">
            <input
              type="file"
              accept=".csv,text/csv"
              className="block min-h-11 text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setCsv(await file.text());
              }}
            />
          </Field>
          <Field label="Or paste the CSV here">
            <Textarea name="csv" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} />
          </Field>
          {preview && (
            <div className="border border-(--color-divider) p-3 text-sm">
              <p className="!m-0">
                {preview.rows.length} product{preview.rows.length === 1 ? "" : "s"} ready
                {preview.errors.length > 0 && `, ${preview.errors.length} problem${preview.errors.length === 1 ? "" : "s"} to fix first`}.
              </p>
              {preview.errors.length > 0 && (
                <ul className="!mt-2 !mb-0 list-disc pl-5 font-semibold text-(--color-accent-900)">
                  {preview.errors.slice(0, 20).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Button disabled={pending || !preview || preview.errors.length > 0 || preview.rows.length === 0}>
            {pending ? "Importing..." : "Import products"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}
