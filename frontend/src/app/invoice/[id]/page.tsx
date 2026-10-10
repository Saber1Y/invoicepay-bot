import { InvoiceView } from "@/components/InvoiceView";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceView idStr={id} />;
}
