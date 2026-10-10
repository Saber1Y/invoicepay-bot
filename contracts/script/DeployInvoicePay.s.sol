// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {InvoicePay} from "../src/InvoicePay.sol";

/// @notice Deploys InvoicePay and prints the address in a greppable line.
/// Usage:
///   forge script script/DeployInvoicePay.s.sol:DeployInvoicePay --rpc-url bot_testnet --broadcast --private-key $PRIVATE_KEY
contract DeployInvoicePay is Script {
    function run() external returns (InvoicePay invoicePay) {
        vm.startBroadcast();
        invoicePay = new InvoicePay();
        vm.stopBroadcast();

        console.log("InvoicePay deployed at:", address(invoicePay));
    }
}