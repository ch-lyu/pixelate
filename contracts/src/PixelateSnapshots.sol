// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pixelate} from "./Pixelate.sol";

/// @title PixelateSnapshots - NFT snapshots of the Pixelate canvas
/// @notice Allows users to mint NFTs capturing the canvas state at specific blocks
contract PixelateSnapshots is ERC721, ERC721URIStorage, Ownable {
    Pixelate public immutable PIXELATE;

    uint256 private _nextTokenId;
    uint256 private _nextSnapshotId;

    uint256 public mintPrice = 0.001 ether;

    struct Snapshot {
        uint256 blockNumber;
        uint256 timestamp;
        bytes32 canvasHash;
        string imageURI;
        address creator;
    }

    mapping(uint256 => Snapshot) public snapshots;
    mapping(uint256 => uint256) public tokenToSnapshot;
    mapping(bytes32 => uint256) public hashToSnapshot; // Prevent duplicate snapshots
    mapping(address => uint256[]) private _userSnapshots; // Track snapshots per user

    error SnapshotAlreadyExists(bytes32 canvasHash, uint256 existingSnapshotId);
    error SnapshotDoesNotExist(uint256 snapshotId);
    error OnlyCreatorCanMint(address creator, address caller);
    error InsufficientPayment(uint256 required, uint256 provided);
    error InvalidImageURI();
    error WithdrawFailed();

    event SnapshotCreated(
        uint256 indexed snapshotId,
        bytes32 canvasHash,
        address indexed creator,
        uint256 blockNumber,
        uint256 timestamp
    );

    event SnapshotMinted(
        uint256 indexed tokenId,
        uint256 indexed snapshotId,
        address indexed minter
    );

    constructor(
        address _pixelate
    ) ERC721("Pixelate Snapshot", "PXSNAP") Ownable(msg.sender) {
        PIXELATE = Pixelate(_pixelate);
    }

    /// @notice Create a snapshot and mint it in one transaction
    /// @param imageURI IPFS URI of the rendered canvas image
    /// @return snapshotId The created snapshot ID
    /// @return tokenId The minted token ID
    function createAndMint(string calldata imageURI) external payable returns (uint256 snapshotId, uint256 tokenId) {
        if (bytes(imageURI).length == 0) revert InvalidImageURI();
        if (msg.value < mintPrice) {
            revert InsufficientPayment(mintPrice, msg.value);
        }

        bytes32 canvasHash = PIXELATE.getCanvasHash();

        if (hashToSnapshot[canvasHash] != 0) {
            revert SnapshotAlreadyExists(canvasHash, hashToSnapshot[canvasHash]);
        }

        // Create snapshot
        snapshotId = ++_nextSnapshotId;

        snapshots[snapshotId] = Snapshot({
            blockNumber: block.number,
            timestamp: block.timestamp,
            canvasHash: canvasHash,
            imageURI: imageURI,
            creator: msg.sender
        });

        hashToSnapshot[canvasHash] = snapshotId;
        _userSnapshots[msg.sender].push(snapshotId);

        emit SnapshotCreated(
            snapshotId,
            canvasHash,
            msg.sender,
            block.number,
            block.timestamp
        );

        // Mint NFT
        tokenId = _nextTokenId++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, imageURI);

        tokenToSnapshot[tokenId] = snapshotId;

        emit SnapshotMinted(tokenId, snapshotId, msg.sender);
    }

    /// @notice Get snapshot details
    function getSnapshot(uint256 snapshotId) external view returns (Snapshot memory) {
        if (snapshots[snapshotId].blockNumber == 0) {
            revert SnapshotDoesNotExist(snapshotId);
        }
        return snapshots[snapshotId];
    }

    /// @notice Get the snapshot ID for a token
    function getTokenSnapshot(uint256 tokenId) external view returns (uint256) {
        return tokenToSnapshot[tokenId];
    }

    /// @notice Get all snapshot IDs created by a user (for library UI)
    function getUserSnapshots(address user) external view returns (uint256[] memory) {
        return _userSnapshots[user];
    }

    /// @notice Get the number of snapshots a user has created
    function getUserSnapshotCount(address user) external view returns (uint256) {
        return _userSnapshots[user].length;
    }

    /// @notice Get total number of snapshots created
    function totalSnapshots() external view returns (uint256) {
        return _nextSnapshotId;
    }

    /// @notice Get total number of NFTs minted
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Update mint price (owner only)
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    /// @notice Withdraw collected fees (owner only)
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = msg.sender.call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    // Required overrides for ERC721URIStorage
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
