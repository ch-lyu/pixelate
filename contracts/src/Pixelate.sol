// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Pixelate {
    uint256 public constant WIDTH = 64;
    uint256 public constant HEIGHT = 64;
    uint256 public constant COOLDOWN = 60 seconds;
    uint8 public constant PALETTE_SIZE = 32;

    struct Pixel {
        uint8 color;
        address lastPlacer;
        uint40 lastPlacedAt;
    }

    mapping(uint256 => Pixel) public pixels;
    mapping(address => uint256) public lastActionTime;

    error XOutOfBounds(uint256 x, uint256 max);
    error YOutOfBounds(uint256 y, uint256 max);
    error InvalidColor(uint8 color, uint8 maxColors);
    error CooldownActive(uint256 remainingSeconds);

    event PixelPlaced(
        uint256 indexed pixelId,
        uint8 color,
        address indexed placer,
        uint256 timestamp
    );

    function placePixel(uint256 x, uint256 y, uint8 color) external {
        if (x >= WIDTH) revert XOutOfBounds(x, WIDTH);
        if (y >= HEIGHT) revert YOutOfBounds(y, HEIGHT);
        if (color >= PALETTE_SIZE) revert InvalidColor(color, PALETTE_SIZE);

        uint256 lastAction = lastActionTime[msg.sender];
        if (lastAction != 0 && block.timestamp < lastAction + COOLDOWN) {
            revert CooldownActive(lastAction + COOLDOWN - block.timestamp);
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

    function getPixel(uint256 x, uint256 y) external view returns (Pixel memory) {
        return pixels[y * WIDTH + x];
    }

    function canPlace(address user) external view returns (bool) {
        uint256 lastAction = lastActionTime[user];
        return lastAction == 0 || block.timestamp >= lastAction + COOLDOWN;
    }

    /// @notice Returns remaining cooldown seconds for a user (0 if can place)
    function getRemainingCooldown(address user) external view returns (uint256) {
        uint256 lastAction = lastActionTime[user];
        if (lastAction == 0) return 0;
        uint256 cooldownEnd = lastAction + COOLDOWN;
        if (block.timestamp >= cooldownEnd) return 0;
        return cooldownEnd - block.timestamp;
    }

    /// @notice Read multiple pixels in one call
    function getPixelBatch(uint256[] calldata pixelIds) external view returns (Pixel[] memory) {
        Pixel[] memory result = new Pixel[](pixelIds.length);
        for (uint256 i = 0; i < pixelIds.length; i++) {
            result[i] = pixels[pixelIds[i]];
        }
        return result;
    }

    /// @notice Get the entire canvas (all 4096 pixels)
    function getAllPixels() external view returns (Pixel[] memory) {
        uint256 totalPixels = WIDTH * HEIGHT;
        Pixel[] memory result = new Pixel[](totalPixels);
        for (uint256 i = 0; i < totalPixels; i++) {
            result[i] = pixels[i];
        }
        return result;
    }

    /// @notice Compute a hash of the current canvas state for verification
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
