import { parseAbi } from "viem";

export const invoiceAbi = parseAbi([
  "struct Invoice { uint256 id; address creator; address recipient; address token; uint256 amount; uint8 status; string clientName; string description; uint256 dueDate; uint256 createdAt; uint256 paidAt; address payer; }",
  "function nextId() view returns (uint256)",
  "function invoiceCount() view returns (uint256)",
  "function createInvoice(address recipient, address token, uint256 amount, string clientName, string description, uint256 dueDate) returns (uint256 id)",
  "function pay(uint256 id) payable",
  "function cancel(uint256 id)",
  "function getInvoice(uint256 id) view returns (Invoice)",
  "function getInvoices(uint256 offset, uint256 limit) view returns (Invoice[])",
  "function idsByCreator(address creator) view returns (uint256[])",
  "event InvoiceCreated(uint256 indexed id, address indexed creator, address indexed recipient, address token, uint256 amount, string clientName, string description, uint256 dueDate)",
  "event InvoicePaid(uint256 indexed id, address indexed payer, address indexed recipient, address token, uint256 amount, uint256 paidAt)",
  "event InvoiceCancelled(uint256 indexed id, address indexed creator)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
