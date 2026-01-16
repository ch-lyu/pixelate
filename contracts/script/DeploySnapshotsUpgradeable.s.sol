// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PixelateSnapshotsUpgradeable} from "../src/PixelateSnapshotsUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeploySnapshotsUpgradeable is Script {
    // The existing Pixelate canvas contract on Base Sepolia
    address constant PIXELATE_ADDRESS = 0x45EaAdBC19e512Fc7951d38192B7d3d3e5404669;

    function run() public {
        vm.startBroadcast();

        // 1. Deploy implementation contract
        PixelateSnapshotsUpgradeable implementation = new PixelateSnapshotsUpgradeable();
        console.log("Implementation deployed at:", address(implementation));

        // 2. Encode initialize call
        bytes memory initData = abi.encodeCall(
            PixelateSnapshotsUpgradeable.initialize,
            (PIXELATE_ADDRESS, msg.sender)
        );

        // 3. Deploy proxy pointing to implementation
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("Proxy deployed at:", address(proxy));
        console.log("");
        console.log(">>> USE THIS PROXY ADDRESS IN YOUR FRONTEND <<<");
        console.log("Linked to Pixelate canvas at:", PIXELATE_ADDRESS);

        vm.stopBroadcast();
    }
}
