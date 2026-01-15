// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Pixelate} from "../src/Pixelate.sol";
import {PixelateSnapshots} from "../src/PixelateSnapshots.sol";

contract PixelateSnapshotsTest is Test {
    Pixelate public pixelate;
    PixelateSnapshots public snapshots;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public owner = address(this);

    string constant SAMPLE_URI = "ipfs://QmTest123";

    function setUp() public {
        pixelate = new Pixelate();
        snapshots = new PixelateSnapshots(address(pixelate));
    }

    // Allow receiving ETH for withdraw test
    receive() external payable {}

    function test_CreateSnapshot() public {
        vm.prank(alice);
        uint256 snapshotId = snapshots.createSnapshot(SAMPLE_URI);

        assertEq(snapshotId, 1);
        assertEq(snapshots.totalSnapshots(), 1);

        PixelateSnapshots.Snapshot memory snap = snapshots.getSnapshot(snapshotId);
        assertEq(snap.creator, alice);
        assertEq(snap.imageURI, SAMPLE_URI);
        assertEq(snap.canvasHash, pixelate.getCanvasHash());
    }

    function test_CreateSnapshot_EmitsEvent() public {
        bytes32 canvasHash = pixelate.getCanvasHash();

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PixelateSnapshots.SnapshotCreated(1, canvasHash, alice, block.number, block.timestamp);
        snapshots.createSnapshot(SAMPLE_URI);
    }

    function test_CreateSnapshot_RevertOnDuplicate() public {
        vm.prank(alice);
        snapshots.createSnapshot(SAMPLE_URI);

        bytes32 canvasHash = pixelate.getCanvasHash();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(
            PixelateSnapshots.SnapshotAlreadyExists.selector,
            canvasHash,
            1
        ));
        snapshots.createSnapshot("ipfs://different");
    }

    function test_CreateSnapshot_AllowsNewAfterCanvasChange() public {
        vm.prank(alice);
        snapshots.createSnapshot(SAMPLE_URI);

        // Change canvas
        vm.prank(alice);
        pixelate.placePixel(0, 0, 5);

        // Should succeed with new canvas state
        vm.prank(bob);
        uint256 snapshotId = snapshots.createSnapshot("ipfs://new");
        assertEq(snapshotId, 2);
    }

    function test_CreateSnapshot_RevertOnEmptyURI() public {
        vm.prank(alice);
        vm.expectRevert(PixelateSnapshots.InvalidImageURI.selector);
        snapshots.createSnapshot("");
    }

    function test_MintSnapshot() public {
        vm.prank(alice);
        uint256 snapshotId = snapshots.createSnapshot(SAMPLE_URI);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        uint256 tokenId = snapshots.mintSnapshot{value: 0.001 ether}(snapshotId);

        assertEq(tokenId, 0);
        assertEq(snapshots.ownerOf(tokenId), alice);
        assertEq(snapshots.tokenURI(tokenId), SAMPLE_URI);
        assertEq(snapshots.getTokenSnapshot(tokenId), snapshotId);
        assertEq(snapshots.totalMinted(), 1);
    }

    function test_MintSnapshot_EmitsEvent() public {
        vm.prank(alice);
        uint256 snapshotId = snapshots.createSnapshot(SAMPLE_URI);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit PixelateSnapshots.SnapshotMinted(0, snapshotId, alice);
        snapshots.mintSnapshot{value: 0.001 ether}(snapshotId);
    }

    function test_MintSnapshot_RevertOnNonCreator() public {
        vm.prank(alice);
        uint256 snapshotId = snapshots.createSnapshot(SAMPLE_URI);

        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(
            PixelateSnapshots.OnlyCreatorCanMint.selector,
            alice,
            bob
        ));
        snapshots.mintSnapshot{value: 0.001 ether}(snapshotId);
    }

    function test_MintSnapshot_RevertOnNonexistent() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(
            PixelateSnapshots.SnapshotDoesNotExist.selector,
            999
        ));
        snapshots.mintSnapshot{value: 0.001 ether}(999);
    }

    function test_MintSnapshot_RevertOnInsufficientPayment() public {
        vm.prank(alice);
        uint256 snapshotId = snapshots.createSnapshot(SAMPLE_URI);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(
            PixelateSnapshots.InsufficientPayment.selector,
            0.001 ether,
            0.0005 ether
        ));
        snapshots.mintSnapshot{value: 0.0005 ether}(snapshotId);
    }

    function test_GetUserSnapshots() public {
        vm.startPrank(alice);
        uint256 snapshotId1 = snapshots.createSnapshot(SAMPLE_URI);

        // Change canvas to allow new snapshot
        pixelate.placePixel(0, 0, 5);
        vm.warp(block.timestamp + 61);
        uint256 snapshotId2 = snapshots.createSnapshot("ipfs://second");
        vm.stopPrank();

        uint256[] memory aliceSnapshots = snapshots.getUserSnapshots(alice);
        assertEq(aliceSnapshots.length, 2);
        assertEq(aliceSnapshots[0], snapshotId1);
        assertEq(aliceSnapshots[1], snapshotId2);

        uint256[] memory bobSnapshots = snapshots.getUserSnapshots(bob);
        assertEq(bobSnapshots.length, 0);
    }

    function test_GetUserSnapshotCount() public {
        vm.startPrank(alice);
        snapshots.createSnapshot(SAMPLE_URI);

        pixelate.placePixel(0, 0, 5);
        vm.warp(block.timestamp + 61);
        snapshots.createSnapshot("ipfs://second");
        vm.stopPrank();

        assertEq(snapshots.getUserSnapshotCount(alice), 2);
        assertEq(snapshots.getUserSnapshotCount(bob), 0);
    }

    function test_CreateAndMint() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (uint256 snapshotId, uint256 tokenId) = snapshots.createAndMint{value: 0.001 ether}(SAMPLE_URI);

        assertEq(snapshotId, 1);
        assertEq(tokenId, 0);
        assertEq(snapshots.ownerOf(tokenId), alice);
        assertEq(snapshots.totalSnapshots(), 1);
        assertEq(snapshots.totalMinted(), 1);
    }

    function test_SetMintPrice() public {
        snapshots.setMintPrice(0.01 ether);
        assertEq(snapshots.mintPrice(), 0.01 ether);
    }

    function test_SetMintPrice_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        snapshots.setMintPrice(0.01 ether);
    }

    function test_Withdraw() public {
        vm.prank(alice);
        uint256 snapshotId = snapshots.createSnapshot(SAMPLE_URI);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        snapshots.mintSnapshot{value: 0.001 ether}(snapshotId);

        uint256 balanceBefore = owner.balance;
        snapshots.withdraw();
        uint256 balanceAfter = owner.balance;

        assertEq(balanceAfter - balanceBefore, 0.001 ether);
    }

    function test_Withdraw_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        snapshots.withdraw();
    }
}
