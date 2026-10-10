"use client";

import { useState } from "react";
import Link from "next/link";
import { useChainId } from "wagmi";
import { ArrowUpRight, FileText, RefreshCw } from "lucide-react";
import { explorerAddress } from "@/config/chains";
import { getNetwork, isDeployed } from "@/config/contracts";
import { useInvoiceCount, useInvoices } from "@/lib/useInvoices";
import { decimalsFor, formatAmount, formatDate, tokenLabel } from "@/lib/format";
import { invoiceNumber, visualStatus, type Invoice, type VisualStatus } from "@/lib/types";
import { PRODUCT } from "@/lib/product";
import { Badge, Button, Card, Spinner } from "@/components/ui";

const FILTERS = ["All", "Pending", "Paid", "Overdue", "Cancelled"] as const;
type Filter = (typeof FILTERS)[number];

function tone(status: VisualStatus) {
  if (status === "Paid") return "success" as const;
  if (status === "Cancelled") return "danger" as const;
  if (status === "Overdue") return "danger" as const;
  return "warning" as const;
}

export function InvoiceList() {
  const [windowSize, setWindowSize] = useState(10);
  const [filter, setFilter] = useState<Filter>("All");

  const chainId = useChainId();
  const network = getNetwork(chainId);
  const deployed = isDeployed(network.contract);

  const { data: count } = useInvoiceCount();
  const total = Number((count as bigint | undefined) ?? 0n);
  const offset = Math.max(0, total - windowSize);
  const limit = Math.min(windowSize, total);
  const { invoices, isLoading, isFetching, refetch } = useInvoices(offset, limit);

  const rows = [...invoices]
    .reverse()
    .filter((inv) => filter === "All" || visualStatus(inv) === filter);

  const hasMore = offset > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-lg border px-3 py-1.5 text-sm transition-colors " +
                (filter === f
                  ? "border-accent-500/60 bg-accent-500/10 text-accent-300"
                  : "border-line bg-ink-850 text-muted hover:border-ink-600 hover:text-white")
              }
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">
            {total} invoice{total === 1 ? "" : "s"} on-chain
          </span>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-16 animate-pulse rounded bg-ink-800" />
                <div className="h-4 flex-1 animate-pulse rounded bg-ink-800" />
                <div className="h-4 w-24 animate-pulse rounded bg-ink-800" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="mx-auto size-8 text-muted" />
            <p className="mt-4 text-sm text-muted">
              {total === 0 ? "No invoices yet." : "No invoices match this filter."}
            </p>
            {total === 0 && (
              <Link
                href="/create"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-accent-400"
              >
                Create your first invoice
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((inv) => (
              <InvoiceRow key={inv.id.toString()} invoice={inv} usdt={network.usdt} />
            ))}
          </ul>
        )}
      </Card>

      <div className="flex items-center justify-between">
        {hasMore ? (
          <Button variant="outline" onClick={() => setWindowSize((s) => s + 10)} disabled={isFetching}>
            {isFetching ? <Spinner /> : null}
            Load older
          </Button>
        ) : (
          <span className="text-xs text-muted">
            Showing all {total} invoice{total === 1 ? "" : "s"}.
          </span>
        )}
        <a
          href={explorerAddress(chainId, network.contract)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white"
        >
          View contract on explorer <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      {!deployed && (
        <p className="text-center text-xs text-warn-400">
          InvoicePay contract address is not set for this network.
        </p>
      )}
    </div>
  );
}

function InvoiceRow({ invoice, usdt }: { invoice: Invoice; usdt: `0x${string}` }) {
  const decimals = decimalsFor(invoice.token);
  const symbol = tokenLabel(invoice.token, usdt);
  const status = visualStatus(invoice);

  return (
    <li>
      <Link
        href={`/invoice/${invoice.id}`}
        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-850"
      >
        <span className="w-20 shrink-0 font-mono text-xs text-muted">
          {invoiceNumber(invoice.id)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm text-white">
              {invoice.clientName || "Untitled client"}
            </span>
            <Badge tone="neutral" className="hidden shrink-0 sm:inline-flex">
              {PRODUCT.name}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            {invoice.description || "No description"}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="font-mono text-sm text-white">
            {formatAmount(invoice.amount, decimals)} {symbol}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {invoice.dueDate > 0n ? `due ${formatDate(invoice.dueDate)}` : "no due date"}
          </p>
        </div>
        <Badge tone={tone(status)} className="w-24 justify-center">
          {status}
        </Badge>
      </Link>
    </li>
  );
}
