// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PixelateUpgradeable} from "../src/PixelateUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployUpgradeable is Script {
    function run() public {
        uint256 initialCooldown = 5 seconds;

        vm.startBroadcast();

        // 1. Deploy implementation contract
        PixelateUpgradeable implementation = new PixelateUpgradeable();
        console.log("Implementation deployed at:", address(implementation));

        // 2. Encode initialize call
        bytes memory initData = abi.encodeCall(
            PixelateUpgradeable.initialize,
            (msg.sender, initialCooldown)
        );

        // 3. Deploy proxy pointing to implementation
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("Proxy deployed at:", address(proxy));
        console.log("");
        console.log(">>> USE THIS PROXY ADDRESS IN YOUR FRONTEND <<<");

        vm.stopBroadcast();
    }
}
