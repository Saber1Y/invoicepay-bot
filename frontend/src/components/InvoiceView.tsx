"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { parseEventLogs } from "viem";
import { ArrowUpRight, CircleCheck, Clock, ShieldCheck, XCircle } from "lucide-react";
import { erc20Abi, invoiceAbi } from "@/lib/abi/contractAbi";
import { explorerAddress, explorerTx } from "@/config/chains";
import { getNetwork, isDeployed } from "@/config/contracts";
import { useInvoice } from "@/lib/useInvoices";
import { decimalsFor, formatAmount, formatDate, formatTime, shortenAddress, tokenLabel } from "@/lib/format";
import { PRODUCT } from "@/lib/product";
import { invoiceNumber, visualStatus, type Invoice } from "@/lib/types";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";

function shortError(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string };
  return err.shortMessage || err.message?.split("\n")[0] || "Transaction failed.";
}

function tone(status: ReturnType<typeof visualStatus>) {
  if (status === "Paid") return "success" as const;
  if (status === "Cancelled" || status === "Overdue") return "danger" as const;
  return "warning" as const;
}

export function InvoiceView({ idStr }: { idStr: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidHash, setPaidHash] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  let id: bigint | undefined;
  try {
    id = BigInt(idStr);
  } catch {
    id = undefined;
  }

  const { data, isLoading, isError, refetch } = useInvoice(id);
  const invoice = data as unknown as Invoice | undefined;

  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const network = getNetwork(chainId);
  const deployed = isDeployed(network.contract);

  const isNativeTok = invoice?.token === "0x0000000000000000000000000000000000000000";
  const { data: allowance } = useReadContract({
    address: invoice?.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, network.contract] : undefined,
    query: { enabled: !!address && !!invoice && !isNativeTok },
  });

  async function onPay() {
    if (!invoice || !address || !publicClient) return;
    setError(null);
    setBusy(true);
    try {
      const needsApproval =
        !isNativeTok && ((allowance as bigint | undefined) ?? 0n) < invoice.amount;
      if (needsApproval) {
        const approveHash = await writeContractAsync({
          address: invoice.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [network.contract, invoice.amount],
          chainId,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      const hash = await writeContractAsync({
        address: network.contract,
        abi: invoiceAbi,
        functionName: "pay",
        args: [invoice.id],
        value: isNativeTok ? invoice.amount : 0n,
        chainId,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Verify the receipt actually settles this invoice: success, matching
      // recipient and amount. The contract rejects double-payment via NotPending.
      const [event] = parseEventLogs({
        abi: invoiceAbi,
        eventName: "InvoicePaid",
        logs: receipt.logs,
      });
      const args = event?.args as { recipient?: string; amount?: bigint } | undefined;
      const ok =
        receipt.status === "success" &&
        !!args &&
        args.recipient?.toLowerCase() === invoice.recipient.toLowerCase() &&
        args.amount === invoice.amount;

      setPaidHash(hash);
      setVerified(ok);
      refetch();
    } catch (e) {
      setError(shortError(e));
    } finally {
      setBusy(false);
    }
  }

  if (id === undefined || isError) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <XCircle className="mx-auto size-8 text-danger-400" />
        <h1 className="mt-4 text-lg font-semibold">Invoice not found</h1>
        <p className="mt-1 text-sm text-muted">This invoice link does not exist on this network.</p>
      </Card>
    );
  }

  if (isLoading || !invoice) {
    return (
      <Card className="mx-auto max-w-2xl space-y-4 p-8">
        <div className="h-6 w-32 animate-pulse rounded bg-ink-800" />
        <div className="h-12 w-56 animate-pulse rounded bg-ink-800" />
        <div className="h-40 animate-pulse rounded bg-ink-800" />
      </Card>
    );
  }

  const decimals = decimalsFor(invoice.token);
  const symbol = tokenLabel(invoice.token, network.usdt);
  const status = visualStatus(invoice);
  const isPaid = invoice.status === 1;
  const isCancelled = invoice.status === 2;
  const settled = isPaid || isCancelled || paidHash !== null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-ink-850 px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted">
              {PRODUCT.name} invoice
            </span>
            <Badge tone={tone(status)}>
              {status === "Paid" && <CircleCheck className="size-3.5" />}
              {status === "Pending" && <Clock className="size-3.5" />}
              {(status === "Cancelled" || status === "Overdue") && <XCircle className="size-3.5" />}
              {status}
            </Badge>
          </div>
          <p className="mt-4 font-mono text-2xl font-semibold tracking-tight">
            {invoiceNumber(invoice.id)}
          </p>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-mono text-5xl font-semibold tracking-tight">
              {formatAmount(invoice.amount, decimals)}
            </span>
            <span className="text-2xl text-muted">{symbol}</span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted">Amount due</p>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Billed to</p>
              <p className="mt-1 break-words text-sm text-white">
                {invoice.clientName || <span className="text-muted">-</span>}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">From</p>
              <p className="mt-1 break-all font-mono text-xs text-white">
                {shortenAddress(invoice.creator)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Description of work</p>
            <p className="mt-1 break-words text-sm text-white">
              {invoice.description || <span className="text-muted">No description</span>}
            </p>
          </div>
        </div>

        <dl className="divide-y divide-line border-t border-line px-6 text-sm sm:px-8">
          <Row
            label="Due date"
            value={invoice.dueDate > 0n ? formatDate(invoice.dueDate) : "-"}
            bad={status === "Overdue"}
          />
          <Row label="Issued" value={formatTime(invoice.createdAt)} />
          <Row label="Payout wallet" value={shortenAddress(invoice.recipient)} mono />
          {isPaid && <Row label="Paid by" value={shortenAddress(invoice.payer)} mono />}
          {isPaid && <Row label="Paid at" value={formatTime(invoice.paidAt)} />}
        </dl>
      </Card>

      <div className="space-y-4">
        <Card className="p-6">
          {paidHash || isPaid ? (
            <div className="text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent-500/15 text-accent-400">
                <CircleCheck className="size-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Invoice paid</h2>
              <p className="mt-1 text-sm text-muted">
                {formatAmount(invoice.amount, decimals)} {symbol} settled on BOT Chain.
              </p>
              {paidHash && (
                <a
                  href={explorerTx(chainId, paidHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-2 text-sm text-accent-400 hover:text-accent-300"
                >
                  View transaction <ArrowUpRight className="size-4" />
                </a>
              )}
              {verified !== null && (
                <div
                  className={
                    "mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs " +
                    (verified
                      ? "border-accent-600/40 bg-accent-600/10 text-accent-300"
                      : "border-danger-400/30 bg-danger-400/10 text-danger-400")
                  }
                >
                  <ShieldCheck className="size-3.5" />
                  {verified
                    ? "Verified: recipient and amount match on-chain"
                    : "Could not verify recipient/amount on-chain"}
                </div>
              )}
            </div>
          ) : isCancelled ? (
            <div className="text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-danger-400/10 text-danger-400">
                <XCircle className="size-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Invoice cancelled</h2>
              <p className="mt-1 text-sm text-muted">The issuer cancelled this invoice.</p>
            </div>
          ) : !address ? (
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                Pay {formatAmount(invoice.amount, decimals)} {symbol}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Connect a wallet to settle {invoiceNumber(invoice.id)}.
              </p>
              <Button className="mt-5 w-full" onClick={() => connect({ connector: connectors[0] })}>
                Connect Wallet
              </Button>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold">
                Pay {formatAmount(invoice.amount, decimals)} {symbol}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {symbol} goes directly to the payout wallet. Success is verified on-chain before the
                invoice is marked paid.
              </p>
              <Button className="mt-5 w-full" size="lg" onClick={onPay} disabled={busy || !deployed}>
                {busy ? <Spinner /> : null}
                {busy ? "Waiting for wallet..." : `Pay ${formatAmount(invoice.amount, decimals)} ${symbol}`}
              </Button>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-danger-400/30 bg-danger-400/10 px-3 py-2 text-sm text-danger-400">
              {error}
            </p>
          )}
        </Card>

        {!settled && (
          <Card className="flex items-center justify-between gap-3 p-4">
            <span className="text-xs text-muted">{PRODUCT.shareNote}</span>
            <CopyButton
              value={typeof window !== "undefined" ? window.location.href : ""}
              label="Copy link"
            />
          </Card>
        )}

        <a
          href={explorerAddress(chainId, network.contract)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-xl border border-line bg-ink-900/80 px-4 py-3 text-xs text-muted transition-colors hover:border-ink-600 hover:text-white"
        >
          <span>All invoices for this contract</span>
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  bad,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bad?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "text-sm"}>
        <span className={bad ? "text-danger-400" : "text-white"}>{value}</span>
      </dd>
    </div>
  );
}
