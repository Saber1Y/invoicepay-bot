"use client";

import { useChainId, useReadContract } from "wagmi";
import { invoiceAbi } from "@/lib/abi/contractAbi";
import { getNetwork } from "@/config/contracts";
import type { Invoice } from "@/lib/types";

export function useInvoiceCount() {
  const chainId = useChainId();
  const { contract } = getNetwork(chainId);
  return useReadContract({
    address: contract,
    abi: invoiceAbi,
    functionName: "invoiceCount",
    chainId,
    query: { refetchInterval: 8000 },
  });
}

/** The id the next created invoice will receive (used for the live preview). */
export function useNextInvoiceId() {
  const chainId = useChainId();
  const { contract } = getNetwork(chainId);
  return useReadContract({
    address: contract,
    abi: invoiceAbi,
    functionName: "nextId",
    chainId,
    query: { refetchInterval: 15000 },
  });
}

export function useInvoices(offset: number, limit: number) {
  const chainId = useChainId();
  const { contract } = getNetwork(chainId);
  const result = useReadContract({
    address: contract,
    abi: invoiceAbi,
    functionName: "getInvoices",
    args: [BigInt(offset), BigInt(limit)],
    chainId,
    query: { refetchInterval: 8000 },
  });
  const invoices = (result.data ?? []) as unknown as Invoice[];
  return { ...result, invoices };
}

export function useInvoice(id: bigint | undefined) {
  const chainId = useChainId();
  const { contract } = getNetwork(chainId);
  return useReadContract({
    address: contract,
    abi: invoiceAbi,
    functionName: "getInvoice",
    args: id !== undefined ? [id] : undefined,
    chainId,
    query: { enabled: id !== undefined, refetchInterval: 6000 },
  });
}
