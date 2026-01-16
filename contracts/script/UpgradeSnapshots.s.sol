// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PixelateSnapshotsUpgradeable} from "../src/PixelateSnapshotsUpgradeable.sol";

contract UpgradeSnapshots is Script {
    // Deployed proxy address on Base Sepolia
    address constant PROXY_ADDRESS = 0xC684D2464b60F93B44e0B68bF4d594a92aD72B5E;

    function run() public {
        vm.startBroadcast();

        // 1. Deploy new implementation
        PixelateSnapshotsUpgradeable newImplementation = new PixelateSnapshotsUpgradeable();
        console.log("New implementation deployed at:", address(newImplementation));

        // 2. Upgrade proxy to new implementation
        PixelateSnapshotsUpgradeable proxy = PixelateSnapshotsUpgradeable(PROXY_ADDRESS);
        proxy.upgradeToAndCall(address(newImplementation), "");

        console.log("Proxy upgraded successfully!");
        console.log("Proxy address (unchanged):", PROXY_ADDRESS);

        vm.stopBroadcast();
    }
}
