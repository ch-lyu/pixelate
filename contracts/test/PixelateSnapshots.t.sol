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

    function test_CreateAndMint() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (uint256 snapshotId, uint256 tokenId) = snapshots.createAndMint{value: 0.001 ether}(SAMPLE_URI);

        assertEq(snapshotId, 1);
        assertEq(tokenId, 0);
        assertEq(snapshots.ownerOf(tokenId), alice);
        assertEq(snapshots.totalSnapshots(), 1);
        assertEq(snapshots.totalMinted(), 1);
        assertEq(snapshots.tokenURI(tokenId), SAMPLE_URI);
        assertEq(snapshots.getTokenSnapshot(tokenId), snapshotId);
    }

    function test_CreateAndMint_EmitsEvents() public {
        bytes32 canvasHash = pixelate.getCanvasHash();

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        
        vm.expectEmit(true, true, false, true);
        emit PixelateSnapshots.SnapshotCreated(1, canvasHash, alice, block.number, block.timestamp);
        vm.expectEmit(true, true, true, true);
        emit PixelateSnapshots.SnapshotMinted(0, 1, alice);
        
        snapshots.createAndMint{value: 0.001 ether}(SAMPLE_URI);
    }

    function test_CreateAndMint_RevertOnDuplicate() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        snapshots.createAndMint{value: 0.001 ether}(SAMPLE_URI);

        bytes32 canvasHash = pixelate.getCanvasHash();

        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(
            PixelateSnapshots.SnapshotAlreadyExists.selector,
            canvasHash,
            1
        ));
        snapshots.createAndMint{value: 0.001 ether}("ipfs://different");
    }

    function test_CreateAndMint_AllowsNewAfterCanvasChange() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        snapshots.createAndMint{value: 0.001 ether}(SAMPLE_URI);

        // Change canvas
        vm.prank(alice);
        pixelate.placePixel(0, 0, 5);

        // Should succeed with new canvas state
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        (uint256 snapshotId, ) = snapshots.createAndMint{value: 0.001 ether}("ipfs://new");
        assertEq(snapshotId, 2);
    }

    function test_CreateAndMint_RevertOnEmptyURI() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(PixelateSnapshots.InvalidImageURI.selector);
        snapshots.createAndMint{value: 0.001 ether}("");
    }

    function test_CreateAndMint_RevertOnInsufficientPayment() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(
            PixelateSnapshots.InsufficientPayment.selector,
            0.001 ether,
            0.0005 ether
        ));
        snapshots.createAndMint{value: 0.0005 ether}(SAMPLE_URI);
    }

    function test_GetSnapshot() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (uint256 snapshotId, ) = snapshots.createAndMint{value: 0.001 ether}(SAMPLE_URI);

        PixelateSnapshots.Snapshot memory snap = snapshots.getSnapshot(snapshotId);
        assertEq(snap.creator, alice);
        assertEq(snap.imageURI, SAMPLE_URI);
        assertEq(snap.canvasHash, pixelate.getCanvasHash());
    }

    function test_GetSnapshot_RevertOnNonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(
            PixelateSnapshots.SnapshotDoesNotExist.selector,
            999
        ));
        snapshots.getSnapshot(999);
    }

    function test_GetUserSnapshots() public {
        vm.deal(alice, 1 ether);
        vm.startPrank(alice);
        (uint256 snapshotId1, ) = snapshots.createAndMint{value: 0.001 ether}(SAMPLE_URI);

        // Change canvas to allow new snapshot
        pixelate.placePixel(0, 0, 5);
        vm.warp(block.timestamp + 61);
        (uint256 snapshotId2, ) = snapshots.createAndMint{value: 0.001 ether}("ipfs://second");
        vm.stopPrank();

        uint256[] memory aliceSnapshots = snapshots.getUserSnapshots(alice);
        assertEq(aliceSnapshots.length, 2);
        assertEq(aliceSnapshots[0], snapshotId1);
        assertEq(aliceSnapshots[1], snapshotId2);

        uint256[] memory bobSnapshots = snapshots.getUserSnapshots(bob);
        assertEq(bobSnapshots.length, 0);
    }

    function test_GetUserSnapshotCount() public {
        vm.deal(alice, 1 ether);
        vm.startPrank(alice);
        snapshots.createAndMint{value: 0.001 ether}(SAMPLE_URI);

        pixelate.placePixel(0, 0, 5);
        vm.warp(block.timestamp + 61);
        snapshots.createAndMint{value: 0.001 ether}("ipfs://second");
        vm.stopPrank();

        assertEq(snapshots.getUserSnapshotCount(alice), 2);
        assertEq(snapshots.getUserSnapshotCount(bob), 0);
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
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        snapshots.createAndMint{value: 0.001 ether}(SAMPLE_URI);

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
