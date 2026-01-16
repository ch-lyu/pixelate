// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {PixelateUpgradeable} from "../src/PixelateUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract PixelateUpgradeableTest is Test {
    PixelateUpgradeable public pixelate;
    PixelateUpgradeable public implementation;
    ERC1967Proxy public proxy;

    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);

    uint256 public constant COOLDOWN = 5 seconds;

    function setUp() public {
        // Deploy implementation
        implementation = new PixelateUpgradeable();

        // Deploy proxy with initialization
        bytes memory initData = abi.encodeCall(
            PixelateUpgradeable.initialize,
            (owner, COOLDOWN)
        );
        proxy = new ERC1967Proxy(address(implementation), initData);

        // Cast proxy to contract interface
        pixelate = PixelateUpgradeable(address(proxy));
    }

    function test_Initialize() public view {
        assertEq(pixelate.cooldown(), COOLDOWN);
        assertEq(pixelate.owner(), owner);
        assertEq(pixelate.WIDTH(), 64);
        assertEq(pixelate.HEIGHT(), 64);
        assertEq(pixelate.PALETTE_SIZE(), 32);
    }

    function test_PlacePixel() public {
        vm.prank(user1);
        pixelate.placePixel(10, 20, 5);

        PixelateUpgradeable.Pixel memory pixel = pixelate.getPixel(10, 20);
        assertEq(pixel.color, 5);
        assertEq(pixel.lastPlacer, user1);
    }

    function test_PlacePixel_RevertOutOfBounds() public {
        vm.expectRevert(abi.encodeWithSelector(PixelateUpgradeable.XOutOfBounds.selector, 64, 64));
        pixelate.placePixel(64, 0, 1);

        vm.expectRevert(abi.encodeWithSelector(PixelateUpgradeable.YOutOfBounds.selector, 64, 64));
        pixelate.placePixel(0, 64, 1);
    }

    function test_PlacePixel_RevertInvalidColor() public {
        vm.expectRevert(abi.encodeWithSelector(PixelateUpgradeable.InvalidColor.selector, 32, 32));
        pixelate.placePixel(0, 0, 32);
    }

    function test_Cooldown() public {
        vm.startPrank(user1);

        // First placement should work
        pixelate.placePixel(0, 0, 1);

        // Immediate second placement should fail
        vm.expectRevert();
        pixelate.placePixel(1, 1, 2);

        // After cooldown, should work
        vm.warp(block.timestamp + COOLDOWN + 1);
        pixelate.placePixel(1, 1, 2);

        vm.stopPrank();
    }

    function test_GetRemainingCooldown() public {
        vm.prank(user1);
        pixelate.placePixel(0, 0, 1);

        uint256 remaining = pixelate.getRemainingCooldown(user1);
        assertEq(remaining, COOLDOWN);

        vm.warp(block.timestamp + 2);
        remaining = pixelate.getRemainingCooldown(user1);
        assertEq(remaining, COOLDOWN - 2);

        vm.warp(block.timestamp + COOLDOWN);
        remaining = pixelate.getRemainingCooldown(user1);
        assertEq(remaining, 0);
    }

    function test_CanPlace() public {
        assertTrue(pixelate.canPlace(user1));

        vm.prank(user1);
        pixelate.placePixel(0, 0, 1);

        assertFalse(pixelate.canPlace(user1));

        vm.warp(block.timestamp + COOLDOWN + 1);
        assertTrue(pixelate.canPlace(user1));
    }

    function test_GetAllPixels() public {
        vm.prank(user1);
        pixelate.placePixel(0, 0, 5);

        vm.warp(block.timestamp + COOLDOWN + 1);

        vm.prank(user2);
        pixelate.placePixel(63, 63, 10);

        PixelateUpgradeable.Pixel[] memory allPixels = pixelate.getAllPixels();
        assertEq(allPixels.length, 64 * 64);
        assertEq(allPixels[0].color, 5);
        assertEq(allPixels[63 * 64 + 63].color, 10);
    }

    function test_GetCanvasHash() public {
        bytes32 hash1 = pixelate.getCanvasHash();

        vm.prank(user1);
        pixelate.placePixel(0, 0, 5);

        bytes32 hash2 = pixelate.getCanvasHash();
        assertTrue(hash1 != hash2);
    }

    function test_SetCooldown_OnlyOwner() public {
        pixelate.setCooldown(10 seconds);
        assertEq(pixelate.cooldown(), 10 seconds);

        vm.prank(user1);
        vm.expectRevert();
        pixelate.setCooldown(1 seconds);
    }
}
