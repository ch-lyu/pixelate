// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PixelateUpgradeable} from "../src/PixelateUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract UpgradePixelate is Script {
    function run(address proxyAddress) public {
        vm.startBroadcast();

        // 1. Deploy new implementation
        PixelateUpgradeable newImplementation = new PixelateUpgradeable();
        console.log("New implementation deployed at:", address(newImplementation));

        // 2. Upgrade proxy to point to new implementation
        UUPSUpgradeable proxy = UUPSUpgradeable(proxyAddress);
        proxy.upgradeToAndCall(address(newImplementation), "");

        console.log("Proxy upgraded successfully!");
        console.log("Proxy address (unchanged):", proxyAddress);

        vm.stopBroadcast();
    }
}
