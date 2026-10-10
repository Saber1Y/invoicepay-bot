// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  InvoicePay
/// @notice On-chain invoicing on BOT Chain. A freelancer or vendor creates an
///         invoice (client name, work description, amount due and due date),
///         shares its "/invoice/<id>" link, and the client settles it. Every
///         invoice and its payment are readable on-chain, so no indexer or
///         database is required.
/// @dev    Settlement is direct: the payer moves funds straight to the
///         recipient. Supported assets are native BOT (token == address(0))
///         and any standard ERC-20 such as USDT.
contract InvoicePay {
    enum Status {
        Pending,
        Paid,
        Cancelled
    }

    struct Invoice {
        uint256 id;
        address creator; // the freelancer / vendor who issued the invoice
        address recipient; // wallet that receives the funds
        address token; // address(0) => native BOT
        uint256 amount; // amount due, in the token's smallest unit
        Status status;
        string clientName; // "Billed to"
        string description; // work description
        uint256 dueDate; // unix seconds; 0 means no deadline
        uint256 createdAt;
        uint256 paidAt;
        address payer;
    }

    /// @notice Next id that will be assigned. Ids start at 1; id 0 means "missing".
    uint256 public nextId = 1;

    mapping(uint256 => Invoice) private _invoices;
    uint256[] private _allIds;

    event InvoiceCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed recipient,
        address token,
        uint256 amount,
        string clientName,
        string description,
        uint256 dueDate
    );

    event InvoicePaid(
        uint256 indexed id,
        address indexed payer,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 paidAt
    );

    event InvoiceCancelled(uint256 indexed id, address indexed creator);

    error NotFound();
    error NotPending();
    error NotCreator();
    error ZeroRecipient();
    error ZeroAmount();
    error WrongAmount(uint256 expected, uint256 sent);
    error NativeNotAllowed();
    error TransferFailed();

    /// @notice Create an invoice.
    /// @param recipient   Wallet that receives the funds (usually the issuer).
    /// @param token       ERC-20 address, or address(0) for native BOT.
    /// @param amount      Amount due, in the token's smallest unit.
    /// @param clientName  Name of the client being billed ("Billed to").
    /// @param description Short description of the work or goods.
    /// @param dueDate     Unix timestamp deadline; 0 for no due date.
    function createInvoice(
        address recipient,
        address token,
        uint256 amount,
        string calldata clientName,
        string calldata description,
        uint256 dueDate
    ) external returns (uint256 id) {
        if (recipient == address(0)) revert ZeroRecipient();
        if (amount == 0) revert ZeroAmount();

        id = nextId++;
        Invoice storage inv = _invoices[id];
        inv.id = id;
        inv.creator = msg.sender;
        inv.recipient = recipient;
        inv.token = token;
        inv.amount = amount;
        inv.status = Status.Pending;
        inv.clientName = clientName;
        inv.description = description;
        inv.dueDate = dueDate;
        inv.createdAt = block.timestamp;

        _allIds.push(id);

        emit InvoiceCreated(id, msg.sender, recipient, token, amount, clientName, description, dueDate);
    }

    /// @notice Settle a pending invoice. Native invoices must send msg.value == amount.
    ///         ERC-20 invoices must have approved this contract for at least `amount`.
    function pay(uint256 id) external payable {
        Invoice storage inv = _invoices[id];
        if (inv.id == 0) revert NotFound();
        if (inv.status != Status.Pending) revert NotPending();

        if (inv.token == address(0)) {
            if (msg.value != inv.amount) revert WrongAmount(inv.amount, msg.value);
            (bool ok, ) = inv.recipient.call{value: inv.amount}("");
            if (!ok) revert TransferFailed();
        } else {
            if (msg.value != 0) revert NativeNotAllowed();
            if (!IERC20(inv.token).transferFrom(msg.sender, inv.recipient, inv.amount)) {
                revert TransferFailed();
            }
        }

        inv.status = Status.Paid;
        inv.paidAt = block.timestamp;
        inv.payer = msg.sender;

        emit InvoicePaid(id, msg.sender, inv.recipient, inv.token, inv.amount, block.timestamp);
    }

    /// @notice Cancel a pending invoice. Only the issuer may cancel.
    function cancel(uint256 id) external {
        Invoice storage inv = _invoices[id];
        if (inv.id == 0) revert NotFound();
        if (msg.sender != inv.creator) revert NotCreator();
        if (inv.status != Status.Pending) revert NotPending();

        inv.status = Status.Cancelled;

        emit InvoiceCancelled(id, msg.sender);
    }

    /// @notice Full invoice record. Reverts when the id does not exist.
    function getInvoice(uint256 id) external view returns (Invoice memory) {
        Invoice memory inv = _invoices[id];
        if (inv.id == 0) revert NotFound();
        return inv;
    }

    /// @notice Total number of invoices ever created.
    function invoiceCount() external view returns (uint256) {
        return _allIds.length;
    }

    /// @notice Page through invoices in creation order (oldest first).
    /// @param offset Starting index in the id list.
    /// @param limit  Maximum number of invoices to return.
    function getInvoices(uint256 offset, uint256 limit) external view returns (Invoice[] memory page) {
        uint256 total = _allIds.length;
        if (offset >= total) {
            return new Invoice[](0);
        }
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        page = new Invoice[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = _invoices[_allIds[i]];
        }
    }

    /// @notice Ids of every invoice created by `creator`, in creation order.
    function idsByCreator(address creator) external view returns (uint256[] memory ids) {
        uint256 total = _allIds.length;
        uint256 count;
        for (uint256 i = 0; i < total; i++) {
            if (_invoices[_allIds[i]].creator == creator) {
                count++;
            }
        }
        ids = new uint256[](count);
        uint256 j;
        for (uint256 i = 0; i < total; i++) {
            if (_invoices[_allIds[i]].creator == creator) {
                ids[j++] = _allIds[i];
            }
        }
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
