// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InvoicePay} from "../src/InvoicePay.sol";

contract MockERC20 {
    string public name = "Mock USD";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        require(balanceOf[from] >= amount, "balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract InvoicePayTest is Test {
    InvoicePay invoicePay;
    MockERC20 usdt;

    address creator = address(0xC0FFEE);
    address payer = address(0xB0B);
    address recipient = address(0xABCD);

    uint256 constant DUE = 2_000_000_000; // a fixed future timestamp

    function setUp() public {
        invoicePay = new InvoicePay();
        usdt = new MockERC20();
        vm.deal(creator, 100 ether);
        vm.deal(payer, 100 ether);
        usdt.mint(payer, 1_000_000e6);
    }

    function test_CreateNativeInvoice() public {
        vm.prank(creator);
        uint256 id = invoicePay.createInvoice(
            recipient, address(0), 1 ether, "Acme Digital", "Landing page design", DUE
        );

        assertEq(id, 1);
        assertEq(invoicePay.nextId(), 2);
        assertEq(invoicePay.invoiceCount(), 1);

        InvoicePay.Invoice memory inv = invoicePay.getInvoice(id);
        assertEq(inv.creator, creator);
        assertEq(inv.recipient, recipient);
        assertEq(inv.amount, 1 ether);
        assertEq(uint8(inv.status), uint8(InvoicePay.Status.Pending));
        assertEq(inv.clientName, "Acme Digital");
        assertEq(inv.description, "Landing page design");
        assertEq(inv.dueDate, DUE);
    }

    function test_PayNativeInvoice() public {
        vm.prank(creator);
        uint256 id = invoicePay.createInvoice(recipient, address(0), 1 ether, "Acme", "Work", DUE);

        uint256 before = recipient.balance;
        vm.prank(payer);
        invoicePay.pay{value: 1 ether}(id);
        assertEq(recipient.balance, before + 1 ether);

        InvoicePay.Invoice memory inv = invoicePay.getInvoice(id);
        assertEq(uint8(inv.status), uint8(InvoicePay.Status.Paid));
        assertEq(inv.payer, payer);
        assertGt(inv.paidAt, 0);
    }

    function test_PayNativeWrongAmountReverts() public {
        vm.prank(creator);
        uint256 id = invoicePay.createInvoice(recipient, address(0), 1 ether, "Acme", "", DUE);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(InvoicePay.WrongAmount.selector, 1 ether, 0.5 ether));
        invoicePay.pay{value: 0.5 ether}(id);
    }

    function test_PayTwiceReverts() public {
        vm.prank(creator);
        uint256 id = invoicePay.createInvoice(recipient, address(0), 1 ether, "Acme", "", DUE);
        vm.prank(payer);
        invoicePay.pay{value: 1 ether}(id);
        vm.prank(payer);
        vm.expectRevert(InvoicePay.NotPending.selector);
        invoicePay.pay{value: 1 ether}(id);
    }

    function test_PayErc20Invoice() public {
        vm.prank(creator);
        uint256 id = invoicePay.createInvoice(recipient, address(usdt), 250e6, "Acme", "Invoice #1", DUE);

        vm.prank(payer);
        usdt.approve(address(invoicePay), 250e6);
        vm.prank(payer);
        invoicePay.pay(id);

        assertEq(usdt.balanceOf(recipient), 250e6);
        assertEq(uint8(invoicePay.getInvoice(id).status), uint8(InvoicePay.Status.Paid));
    }

    function test_PayErc20WithNativeValueReverts() public {
        vm.prank(creator);
        uint256 id = invoicePay.createInvoice(recipient, address(usdt), 250e6, "Acme", "", DUE);
        vm.prank(payer);
        usdt.approve(address(invoicePay), 250e6);
        vm.prank(payer);
        vm.expectRevert(InvoicePay.NativeNotAllowed.selector);
        invoicePay.pay{value: 1}(id);
    }

    function test_Cancel() public {
        vm.prank(creator);
        uint256 id = invoicePay.createInvoice(recipient, address(0), 1 ether, "Acme", "", DUE);
        vm.prank(creator);
        invoicePay.cancel(id);
        assertEq(uint8(invoicePay.getInvoice(id).status), uint8(InvoicePay.Status.Cancelled));
    }

    function test_CancelNotCreatorReverts() public {
        vm.prank(creator);
        uint256 id = invoicePay.createInvoice(recipient, address(0), 1 ether, "Acme", "", DUE);
        vm.prank(payer);
        vm.expectRevert(InvoicePay.NotCreator.selector);
        invoicePay.cancel(id);
    }

    function test_GetInvoiceMissingReverts() public {
        vm.expectRevert(InvoicePay.NotFound.selector);
        invoicePay.getInvoice(999);
    }

    function test_Paging() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(creator);
            invoicePay.createInvoice(recipient, address(0), 1 ether, "Acme", "w", DUE);
        }
        InvoicePay.Invoice[] memory page = invoicePay.getInvoices(1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].id, 2);
        assertEq(page[1].id, 3);

        InvoicePay.Invoice[] memory empty = invoicePay.getInvoices(10, 5);
        assertEq(empty.length, 0);
    }

    function test_IdsByCreator() public {
        vm.prank(creator);
        invoicePay.createInvoice(recipient, address(0), 1 ether, "Acme", "", DUE);
        vm.prank(payer);
        invoicePay.createInvoice(recipient, address(0), 2 ether, "Beta", "", DUE);

        uint256[] memory ids = invoicePay.idsByCreator(creator);
        assertEq(ids.length, 1);
        assertEq(ids[0], 1);
    }

    function test_ZeroAmountReverts() public {
        vm.prank(creator);
        vm.expectRevert(InvoicePay.ZeroAmount.selector);
        invoicePay.createInvoice(recipient, address(0), 0, "Acme", "", DUE);
    }

    function test_ZeroRecipientReverts() public {
        vm.prank(creator);
        vm.expectRevert(InvoicePay.ZeroRecipient.selector);
        invoicePay.createInvoice(address(0), address(0), 1 ether, "Acme", "", DUE);
    }
}
