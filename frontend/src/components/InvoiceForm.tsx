"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { isAddress, parseEventLogs, parseUnits, type Address } from "viem";
import { ArrowUpRight, ReceiptText } from "lucide-react";
import { invoiceAbi } from "@/lib/abi/contractAbi";
import { explorerTx } from "@/config/chains";
import { getNetwork, isDeployed } from "@/config/contracts";
import { dateInputToUnix, decimalsFor, formatAmount, formatDate } from "@/lib/format";
import { NATIVE_TOKEN, invoiceNumber } from "@/lib/types";
import { useNextInvoiceId } from "@/lib/useInvoices";
import { PRODUCT } from "@/lib/product";
import { Button, Card, Input, Label, Select, Spinner, Textarea } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";

const ZERO = "0x0000000000000000000000000000000000000000";

function shortError(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string };
  return err.shortMessage || err.message?.split("\n")[0] || "Transaction failed.";
}

export function InvoiceForm() {
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"native" | "usdt">("native");
  const [dueDate, setDueDate] = useState("");
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; hash: string } | null>(null);

  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const network = getNetwork(chainId);
  const deployed = isDeployed(network.contract);

  const { data: nextId } = useNextInvoiceId();
  const previewNumber = nextId !== undefined ? invoiceNumber(nextId as bigint) : "INV-###";

  const usdtReady = network.usdt !== ZERO;
  const tokenAddress = token === "native" ? NATIVE_TOKEN : network.usdt;
  const decimals = decimalsFor(tokenAddress);
  const symbol = token === "native" ? "BOT" : "USDT";

  const previewAmount = (() => {
    try {
      return formatAmount(parseUnits(amount || "0", decimals), decimals);
    } catch {
      return amount || "0";
    }
  })();

  const payee = recipient || address || "";
  const previewDue = formatDate(dateInputToUnix(dueDate));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!address) return setError("Connect your wallet first.");
    if (!deployed) return setError("The InvoicePay contract is not deployed on this network yet.");
    if (!clientName.trim()) return setError("Enter the client name you are billing.");
    if (!isAddress(payee)) return setError("Enter a valid payout address (or connect a wallet to use yours).");
    if (token === "usdt" && !usdtReady) return setError("USDT is not configured on this network.");

    let parsed: bigint;
    try {
      parsed = parseUnits(amount, decimals);
    } catch {
      return setError("Enter a valid amount.");
    }
    if (parsed <= 0n) return setError("Amount must be greater than zero.");

    setSubmitting(true);
    try {
      const hash = await writeContractAsync({
        address: network.contract,
        abi: invoiceAbi,
        functionName: "createInvoice",
        args: [
          payee as Address,
          tokenAddress,
          parsed,
          clientName.trim(),
          description,
          dateInputToUnix(dueDate),
        ],
        chainId,
      });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      const [event] = parseEventLogs({
        abi: invoiceAbi,
        eventName: "InvoiceCreated",
        logs: receipt.logs,
      });
      const id = (event?.args as { id?: bigint } | undefined)?.id;
      setResult({ id: (id ?? 0n).toString(), hash });
    } catch (e) {
      setError(shortError(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/invoice/${result.id}`;
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-accent-500/15 text-accent-400">
          <ReceiptText className="size-6" />
        </div>
        <h2 className="text-xl font-semibold">
          {invoiceNumber(result.id)} created
        </h2>
        <p className="mt-1 text-sm text-muted">{PRODUCT.createSuccessBlurb}</p>

        <div className="mt-6 flex items-center gap-2 rounded-lg border border-line bg-ink-850 p-2 pl-4">
          <span className="flex-1 truncate text-left font-mono text-sm text-accent-300">{link}</span>
          <CopyButton value={link} />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/invoice/${result.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-accent-400"
          >
            Open invoice <ArrowUpRight className="size-4" />
          </Link>
          <a
            href={explorerTx(chainId, result.hash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-ink-850 px-4 py-2.5 text-sm hover:border-ink-600"
          >
            View transaction
          </a>
        </div>

        <Link
          href="/invoices"
          className="mt-6 inline-block text-sm text-muted hover:text-white"
        >
          View all invoices
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="clientName">Billed to (client)</Label>
          <Input
            id="clientName"
            placeholder="Acme Digital"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="description">Description of work</Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="Landing page design and development"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <Label htmlFor="amount">Amount due</Label>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="token">Asset</Label>
            <Select
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value as "native" | "usdt")}
            >
              <option value="native">BOT</option>
              <option value="usdt" disabled={!usdtReady}>
                USDT
              </option>
            </Select>
          </div>
          <div>
            <Label htmlFor="dueDate">Due date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="recipient">Payout wallet</Label>
            {address && (
              <button
                type="button"
                onClick={() => setRecipient(address)}
                className="mb-1.5 text-xs text-accent-400 hover:text-accent-300"
              >
                Use my address
              </button>
            )}
          </div>
          <Input
            id="recipient"
            placeholder={address ?? "0x..."}
            className="font-mono"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
          />
          <p className="mt-1.5 text-xs text-muted">
            Where the client&apos;s payment lands. Defaults to your connected wallet.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-danger-400/30 bg-danger-400/10 px-3 py-2 text-sm text-danger-400">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={submitting || !deployed}>
          {submitting ? <Spinner /> : null}
          {submitting ? "Confirming..." : PRODUCT.createCta}
        </Button>

        {!deployed && (
          <p className="text-center text-xs text-warn-400">
            Contract address is not set. Deploy it and update .env.local.
          </p>
        )}
      </form>

      <div className="lg:pt-1">
        <p className="mb-3 text-xs uppercase tracking-wide text-muted">Preview</p>
        <Card className="overflow-hidden">
          <div className="border-b border-line bg-ink-850 px-6 py-5">
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-accent-500/40 bg-accent-500/10 px-2.5 py-0.5 text-xs font-medium text-accent-300">
                {PRODUCT.name}
              </span>
              <span className="font-mono text-xs text-muted">{previewNumber}</span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-semibold tracking-tight">
                {previewAmount}
              </span>
              <span className="text-lg text-muted">{symbol}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Amount due</p>
          </div>
          <div className="space-y-4 px-6 py-5 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Billed to</p>
              <p className="mt-1 break-words text-white">
                {clientName || <span className="text-muted">Client name</span>}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Description</p>
              <p className="mt-1 break-words text-white">
                {description || <span className="text-muted">Description of work</span>}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Due date</p>
              <p className="mt-1 text-white">
                {dueDate ? previewDue : <span className="text-muted">No due date</span>}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Payout wallet</p>
              <p className="mt-1 break-all font-mono text-xs text-white">
                {payee || <span className="text-muted">0x...</span>}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
