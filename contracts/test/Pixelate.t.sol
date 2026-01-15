// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Pixelate} from "../src/Pixelate.sol";

contract PixelateTest is Test {
    Pixelate public pixelate;
    address public alice = address(0x1);
    address public bob = address(0x2);

    function setUp() public {
        pixelate = new Pixelate();
    }

    function test_PlacePixel() public {
        vm.prank(alice);
        pixelate.placePixel(0, 0, 5);

        Pixelate.Pixel memory pixel = pixelate.getPixel(0, 0);
        assertEq(pixel.color, 5);
        assertEq(pixel.lastPlacer, alice);
    }

    function test_PlacePixel_EmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Pixelate.PixelPlaced(0, 5, alice, block.timestamp);
        pixelate.placePixel(0, 0, 5);
    }

    function test_CooldownEnforced() public {
        vm.prank(alice);
        pixelate.placePixel(0, 0, 5);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Pixelate.CooldownActive.selector, 60));
        pixelate.placePixel(1, 1, 3);
    }

    function test_CooldownExpires() public {
        vm.prank(alice);
        pixelate.placePixel(0, 0, 5);

        vm.warp(block.timestamp + 60);

        vm.prank(alice);
        pixelate.placePixel(1, 1, 3);

        Pixelate.Pixel memory pixel = pixelate.getPixel(1, 1);
        assertEq(pixel.color, 3);
    }

    function test_DifferentUsersNoCooldown() public {
        vm.prank(alice);
        pixelate.placePixel(0, 0, 5);

        vm.prank(bob);
        pixelate.placePixel(1, 1, 3);

        Pixelate.Pixel memory pixel = pixelate.getPixel(1, 1);
        assertEq(pixel.color, 3);
        assertEq(pixel.lastPlacer, bob);
    }

    function test_OverwritePixel() public {
        vm.prank(alice);
        pixelate.placePixel(5, 5, 1);

        vm.prank(bob);
        pixelate.placePixel(5, 5, 9);

        Pixelate.Pixel memory pixel = pixelate.getPixel(5, 5);
        assertEq(pixel.color, 9);
        assertEq(pixel.lastPlacer, bob);
    }

    function test_RevertOnInvalidX() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Pixelate.XOutOfBounds.selector, 64, 64));
        pixelate.placePixel(64, 0, 1);
    }

    function test_RevertOnInvalidY() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Pixelate.YOutOfBounds.selector, 64, 64));
        pixelate.placePixel(0, 64, 1);
    }

    function test_RevertOnInvalidColor() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Pixelate.InvalidColor.selector, 32, 32));
        pixelate.placePixel(0, 0, 32);
    }

    function test_CanPlace() public {
        assertTrue(pixelate.canPlace(alice));

        vm.prank(alice);
        pixelate.placePixel(0, 0, 1);

        assertFalse(pixelate.canPlace(alice));

        vm.warp(block.timestamp + 60);
        assertTrue(pixelate.canPlace(alice));
    }

    function test_GetRemainingCooldown() public {
        // No cooldown initially
        assertEq(pixelate.getRemainingCooldown(alice), 0);

        vm.prank(alice);
        pixelate.placePixel(0, 0, 1);

        // Full cooldown after placing
        assertEq(pixelate.getRemainingCooldown(alice), 60);

        // Partial cooldown after some time
        vm.warp(block.timestamp + 30);
        assertEq(pixelate.getRemainingCooldown(alice), 30);

        // No cooldown after full time
        vm.warp(block.timestamp + 30);
        assertEq(pixelate.getRemainingCooldown(alice), 0);
    }

    function test_GetPixelBatch() public {
        vm.prank(alice);
        pixelate.placePixel(0, 0, 5);

        vm.prank(bob);
        pixelate.placePixel(1, 0, 7);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 0; // (0,0)
        ids[1] = 1; // (1,0)

        Pixelate.Pixel[] memory pixels = pixelate.getPixelBatch(ids);

        assertEq(pixels.length, 2);
        assertEq(pixels[0].color, 5);
        assertEq(pixels[0].lastPlacer, alice);
        assertEq(pixels[1].color, 7);
        assertEq(pixels[1].lastPlacer, bob);
    }

    function test_GetAllPixels() public {
        vm.prank(alice);
        pixelate.placePixel(0, 0, 5);

        vm.prank(bob);
        pixelate.placePixel(63, 63, 15);

        Pixelate.Pixel[] memory allPixels = pixelate.getAllPixels();

        assertEq(allPixels.length, 4096);
        assertEq(allPixels[0].color, 5);
        assertEq(allPixels[0].lastPlacer, alice);
        assertEq(allPixels[4095].color, 15);
        assertEq(allPixels[4095].lastPlacer, bob);
    }

    function test_GetCanvasHash() public {
        bytes32 emptyHash = pixelate.getCanvasHash();

        vm.prank(alice);
        pixelate.placePixel(0, 0, 5);

        bytes32 newHash = pixelate.getCanvasHash();

        // Hash should change after placing a pixel
        assertTrue(emptyHash != newHash);

        // Hash should be deterministic
        assertEq(pixelate.getCanvasHash(), newHash);
    }
}
