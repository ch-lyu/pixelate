// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IPixelate {
    struct Pixel {
        uint8 color;
        address lastPlacer;
        uint40 lastPlacedAt;
    }
    function getAllPixels() external view returns (Pixel[] memory);
    function getCanvasHash() external view returns (bytes32);
}

/// @title PixelateSnapshotsUpgradeable - Upgradeable on-chain NFT snapshots
/// @notice Mints NFTs with SVG images generated directly from on-chain pixel data
/// @dev Optimized storage: pixels packed as bytes (1 byte per pixel, 32 pixels per storage slot)
contract PixelateSnapshotsUpgradeable is
    Initializable,
    ERC721Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    using Strings for uint256;

    // ============ Constants ============
    uint256 private constant GRID_SIZE = 64;
    uint256 private constant TOTAL_PIXELS = GRID_SIZE * GRID_SIZE; // 4096

    // ============ State Variables ============
    // WARNING: Never change order, only append new variables at the end

    IPixelate public pixelate;
    uint256 private _nextTokenId;
    uint256 public mintPrice;

    // The 32-color palette (same as frontend)
    string[32] public PALETTE;

    struct Snapshot {
        uint256 blockNumber;
        uint256 timestamp;
        bytes32 canvasHash;
        address creator;
    }

    // Separate mapping for pixel data (packed as bytes, more gas efficient)
    mapping(uint256 => Snapshot) public snapshots;
    mapping(uint256 => bytes) private _pixelData; // 4096 bytes = 128 storage slots
    mapping(bytes32 => uint256) public hashToToken;
    mapping(address => uint256[]) private _userTokens;

    // ============ Errors ============
    error SnapshotAlreadyExists(bytes32 canvasHash, uint256 existingTokenId);
    error InsufficientPayment(uint256 required, uint256 provided);
    error WithdrawFailed();
    error InvalidPixelDataLength(uint256 provided, uint256 expected);
    error InvalidColorIndex(uint256 index, uint8 color);

    // ============ Events ============
    event SnapshotMinted(
        uint256 indexed tokenId,
        bytes32 canvasHash,
        address indexed creator,
        uint256 blockNumber,
        uint256 timestamp
    );

    // ============ Constructor (disabled for proxy) ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Initializer ============
    function initialize(address _pixelate, address initialOwner) public initializer {
        __ERC721_init("Pixelate Snapshot", "PXSNAP");
        __Ownable_init(initialOwner);

        pixelate = IPixelate(_pixelate);
        mintPrice = 0; // Free mint by default, admin can set price later

        // Initialize palette
        PALETTE[0] = "#2A2A2A";
        PALETTE[1] = "#FF6969"; PALETTE[2] = "#FF4191"; PALETTE[3] = "#E4003A";
        PALETTE[4] = "#FF7F3E"; PALETTE[5] = "#F9D689"; PALETTE[6] = "#FFD635"; PALETTE[7] = "#FFA800";
        PALETTE[8] = "#37B7C3"; PALETTE[9] = "#0083C7"; PALETTE[10] = "#0052FF"; PALETTE[11] = "#0000EA";
        PALETTE[12] = "#9B86BD"; PALETTE[13] = "#604CC3"; PALETTE[14] = "#820080"; PALETTE[15] = "#CF6EE4";
        PALETTE[16] = "#0A6847"; PALETTE[17] = "#02BE01"; PALETTE[18] = "#94E044"; PALETTE[19] = "#597445";
        PALETTE[20] = "#91DDCF"; PALETTE[21] = "#00D3DD"; PALETTE[22] = "#00CCC0"; PALETTE[23] = "#00A368";
        PALETTE[24] = "#FFFFFF"; PALETTE[25] = "#E5E1DA"; PALETTE[26] = "#C4C4C4"; PALETTE[27] = "#888888";
        PALETTE[28] = "#640D6B"; PALETTE[29] = "#561C24"; PALETTE[30] = "#A06A42"; PALETTE[31] = "#6D482F";
    }

    // ============ Upgrade Authorization ============
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Core Functions ============

    /// @notice Mint an NFT from provided pixel data (packed as bytes)
    /// @param pixelData Raw bytes where each byte is a color index (0-31)
    /// @dev Validation skipped for gas efficiency - frontend validates before sending
    function mint(bytes calldata pixelData) external payable returns (uint256 tokenId) {
        if (msg.value < mintPrice) {
            revert InsufficientPayment(mintPrice, msg.value);
        }

        if (pixelData.length != TOTAL_PIXELS) {
            revert InvalidPixelDataLength(pixelData.length, TOTAL_PIXELS);
        }

        bytes32 canvasHash = keccak256(pixelData);

        if (hashToToken[canvasHash] != 0) {
            revert SnapshotAlreadyExists(canvasHash, hashToToken[canvasHash]);
        }

        tokenId = ++_nextTokenId;

        // Store snapshot metadata
        snapshots[tokenId] = Snapshot({
            blockNumber: block.number,
            timestamp: block.timestamp,
            canvasHash: canvasHash,
            creator: msg.sender
        });

        // Store pixel data directly
        _pixelData[tokenId] = pixelData;

        hashToToken[canvasHash] = tokenId;
        _userTokens[msg.sender].push(tokenId);

        _safeMint(msg.sender, tokenId);

        emit SnapshotMinted(tokenId, canvasHash, msg.sender, block.number, block.timestamp);
    }

    /// @notice Generate the SVG image for a token
    function generateSVG(uint256 tokenId) public view returns (string memory) {
        bytes storage pixels = _pixelData[tokenId];

        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="1024" height="1024" shape-rendering="crispEdges">'
        );

        for (uint256 y = 0; y < GRID_SIZE; y++) {
            for (uint256 x = 0; x < GRID_SIZE; x++) {
                uint256 index = y * GRID_SIZE + x;
                uint8 colorIndex = uint8(pixels[index]);

                svg = abi.encodePacked(
                    svg,
                    '<rect x="', x.toString(),
                    '" y="', y.toString(),
                    '" width="1" height="1" fill="',
                    PALETTE[colorIndex],
                    '"/>'
                );
            }
        }

        svg = abi.encodePacked(svg, '</svg>');
        return string(svg);
    }

    /// @notice Returns the token URI with on-chain SVG and metadata
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        Snapshot storage snapshot = snapshots[tokenId];

        string memory svg = generateSVG(tokenId);
        string memory svgBase64 = Base64.encode(bytes(svg));

        string memory json = string(abi.encodePacked(
            '{"name":"Pixelate Snapshot #', tokenId.toString(),
            '","description":"A snapshot of the Pixelate collaborative canvas, captured at block ',
            snapshot.blockNumber.toString(),
            '","image":"data:image/svg+xml;base64,', svgBase64,
            '","attributes":[{"trait_type":"Block Number","value":', snapshot.blockNumber.toString(),
            '},{"trait_type":"Timestamp","value":', snapshot.timestamp.toString(),
            '},{"trait_type":"Creator","value":"', _addressToString(snapshot.creator),
            '"}]}'
        ));

        return string(abi.encodePacked(
            'data:application/json;base64,',
            Base64.encode(bytes(json))
        ));
    }

    // ============ View Functions ============

    function getSnapshot(uint256 tokenId) external view returns (
        uint256 blockNumber,
        uint256 timestamp,
        bytes32 canvasHash,
        address creator
    ) {
        Snapshot storage snapshot = snapshots[tokenId];
        return (snapshot.blockNumber, snapshot.timestamp, snapshot.canvasHash, snapshot.creator);
    }

    function getPixelData(uint256 tokenId) external view returns (bytes memory) {
        return _pixelData[tokenId];
    }

    function getUserTokens(address user) external view returns (uint256[] memory) {
        return _userTokens[user];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    // ============ Admin Functions ============

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = msg.sender.call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    // ============ Internal ============

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(uint160(addr) >> (8 * (19 - i)) >> 4) & 0xf];
            str[3 + i * 2] = alphabet[uint8(uint160(addr) >> (8 * (19 - i))) & 0xf];
        }
        return string(str);
    }
}
