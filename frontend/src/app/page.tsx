import Link from "next/link";
import { ArrowRight, CircleCheck, PencilLine, Share2, Wallet } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { PRODUCT } from "@/lib/product";

const STEPS = [
  {
    step: "01",
    title: "Create an invoice",
    body: "Enter the client, the work, the amount due and a due date. InvoicePay assigns the number.",
    icon: PencilLine,
  },
  {
    step: "02",
    title: "Share the link",
    body: "Every invoice gets a unique /invoice/<id> page. Send it to your client however you like.",
    icon: Share2,
  },
  {
    step: "03",
    title: "Client pays",
    body: "Your client connects a wallet and pays in BOT or USDT, straight to your payout wallet.",
    icon: Wallet,
  },
  {
    step: "04",
    title: "Invoice marked paid",
    body: "InvoicePay verifies the on-chain transaction and flips the invoice from Pending to Paid.",
    icon: CircleCheck,
  },
];

export default function Home() {
  return (
    <div className="space-y-20">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-ink-900">
        <div className="grid-band absolute inset-0 opacity-60" />
        <div className="absolute -left-24 -top-24 size-72 rounded-full bg-accent-500/10 blur-3xl" />
        <div className="relative px-6 py-16 sm:px-12 sm:py-24">
          <Badge tone="accent" className="mb-6">
            {PRODUCT.heroBadge}
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            {PRODUCT.heroTitle}{" "}
            <span className="text-accent-400">{PRODUCT.heroHighlight}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">{PRODUCT.heroBody}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-3 text-sm font-medium text-ink-950 transition-colors hover:bg-accent-400"
            >
              {PRODUCT.createCta}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/invoices"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink-850 px-5 py-3 text-sm font-medium transition-colors hover:border-ink-600"
            >
              View invoices
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-8 text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.step} className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-sm text-accent-500">{s.step}</span>
                  <Icon className="size-4 text-muted" />
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm text-accent-400">A proper invoice, on-chain</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Billing built for freelancers and small businesses
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            An invoice number, the client being billed, a description of the work, an amount due and
            a due date. Your client sees a real invoice, not a bare payment request, and the status
            updates the moment they pay.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-muted">
            {[
              "Invoice number and due date on every bill",
              "Track all your invoices in one place",
              "Overdue flag when a due date passes unpaid",
              "Paid only after the on-chain payment is verified",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CircleCheck className="size-4 shrink-0 text-accent-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-line bg-ink-850 px-6 py-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted">
                {PRODUCT.name} invoice
              </span>
              <Badge tone="warning">Pending</Badge>
            </div>
            <p className="mt-4 font-mono text-2xl font-semibold tracking-tight">INV-001</p>
            <div className="mt-5 flex items-baseline gap-2">
              <span className="font-mono text-5xl font-semibold tracking-tight">25</span>
              <span className="text-2xl text-muted">BOT</span>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">Amount due</p>
          </div>
          <div className="space-y-5 px-6 py-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Billed to</p>
              <p className="mt-1 text-sm text-white">Acme Digital</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Description of work</p>
              <p className="mt-1 text-sm text-white">Landing page design and development</p>
            </div>
            <p className="text-xs text-muted">Illustrative amount for a testnet demo.</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
