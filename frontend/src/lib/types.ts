import type { Address } from "viem";

export type Invoice = {
  id: bigint;
  creator: Address;
  recipient: Address;
  token: Address;
  amount: bigint;
  status: number;
  clientName: string;
  description: string;
  dueDate: bigint;
  createdAt: bigint;
  paidAt: bigint;
  payer: Address;
};

export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000" as Address;

export const STATUS = ["Pending", "Paid", "Cancelled"] as const;

/** Derive "Overdue" from a pending invoice whose due date has passed. */
export type VisualStatus = "Pending" | "Paid" | "Cancelled" | "Overdue";

export function visualStatus(
  invoice: Pick<Invoice, "status" | "dueDate">,
  now = Date.now(),
): VisualStatus {
  if (invoice.status === 1) return "Paid";
  if (invoice.status === 2) return "Cancelled";
  if (invoice.dueDate > 0n && Number(invoice.dueDate) * 1000 < now) return "Overdue";
  return "Pending";
}

/** Human-readable invoice number, e.g. INV-001. */
export function invoiceNumber(id: bigint | number | string): string {
  return `INV-${String(id).padStart(3, "0")}`;
}
