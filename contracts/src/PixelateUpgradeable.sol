// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract PixelateUpgradeable is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // ============ Constants ============
    uint256 public constant WIDTH = 64;
    uint256 public constant HEIGHT = 64;
    uint8 public constant PALETTE_SIZE = 32;

    // ============ State Variables ============
    // WARNING: Never change order, only append new variables at the end
    uint256 public cooldown;

    struct Pixel {
        uint8 color;
        address lastPlacer;
        uint40 lastPlacedAt;
    }

    mapping(uint256 => Pixel) public pixels;
    mapping(address => uint256) public lastActionTime;

    // ============ Errors ============
    error XOutOfBounds(uint256 x, uint256 max);
    error YOutOfBounds(uint256 y, uint256 max);
    error InvalidColor(uint8 color, uint8 maxColors);
    error CooldownActive(uint256 remainingSeconds);

    // ============ Events ============
    event PixelPlaced(
        uint256 indexed pixelId,
        uint8 color,
        address indexed placer,
        uint256 timestamp
    );
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    // ============ Constructor (disabled for proxy) ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Initializer (replaces constructor) ============
    function initialize(address initialOwner, uint256 initialCooldown) public initializer {
        __Ownable_init(initialOwner);
        cooldown = initialCooldown;
    }

    // ============ Upgrade Authorization ============
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Admin Functions ============
    function setCooldown(uint256 newCooldown) external onlyOwner {
        uint256 oldCooldown = cooldown;
        cooldown = newCooldown;
        emit CooldownUpdated(oldCooldown, newCooldown);
    }

    // ============ Core Functions ============
    function placePixel(uint256 x, uint256 y, uint8 color) external {
        if (x >= WIDTH) revert XOutOfBounds(x, WIDTH);
        if (y >= HEIGHT) revert YOutOfBounds(y, HEIGHT);
        if (color >= PALETTE_SIZE) revert InvalidColor(color, PALETTE_SIZE);

        uint256 lastAction = lastActionTime[msg.sender];
        if (lastAction != 0 && block.timestamp < lastAction + cooldown) {
            revert CooldownActive(lastAction + cooldown - block.timestamp);
        }

        uint256 pixelId = y * WIDTH + x;

        pixels[pixelId] = Pixel({
            color: color,
            lastPlacer: msg.sender,
            lastPlacedAt: uint40(block.timestamp)
        });

        lastActionTime[msg.sender] = block.timestamp;

        emit PixelPlaced(pixelId, color, msg.sender, block.timestamp);
    }

    // ============ View Functions ============
    function getPixel(uint256 x, uint256 y) external view returns (Pixel memory) {
        return pixels[y * WIDTH + x];
    }

    function canPlace(address user) external view returns (bool) {
        uint256 lastAction = lastActionTime[user];
        return lastAction == 0 || block.timestamp >= lastAction + cooldown;
    }

    function getRemainingCooldown(address user) external view returns (uint256) {
        uint256 lastAction = lastActionTime[user];
        if (lastAction == 0) return 0;
        uint256 cooldownEnd = lastAction + cooldown;
        if (block.timestamp >= cooldownEnd) return 0;
        return cooldownEnd - block.timestamp;
    }

    function getPixelBatch(uint256[] calldata pixelIds) external view returns (Pixel[] memory) {
        Pixel[] memory result = new Pixel[](pixelIds.length);
        for (uint256 i = 0; i < pixelIds.length; i++) {
            result[i] = pixels[pixelIds[i]];
        }
        return result;
    }

    function getAllPixels() external view returns (Pixel[] memory) {
        uint256 totalPixels = WIDTH * HEIGHT;
        Pixel[] memory result = new Pixel[](totalPixels);
        for (uint256 i = 0; i < totalPixels; i++) {
            result[i] = pixels[i];
        }
        return result;
    }

    function getCanvasHash() external view returns (bytes32) {
        bytes memory packed = new bytes(WIDTH * HEIGHT);
        for (uint256 i = 0; i < WIDTH * HEIGHT; i++) {
            packed[i] = bytes1(pixels[i].color);
        }
        bytes32 result;
        assembly {
            result := keccak256(add(packed, 32), mload(packed))
        }
        return result;
    }
}
