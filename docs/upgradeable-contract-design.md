# Upgradeable Contract Design for Pixelate

## Problem

Currently, deploying a new version of `Pixelate.sol` creates a contract at a **new address**, which means:

- All 4096 canvas pixels are lost
- User cooldown history is lost
- Frontend must update to new contract address
- No way to add features without losing state

## Solution: UUPS Proxy Pattern

Use OpenZeppelin's **UUPS (Universal Upgradeable Proxy Standard)** to separate storage from logic.

```
Users interact with PROXY address (never changes)
              │
              ▼
┌─────────────────────────────┐
│        ERC1967 Proxy        │
│     (permanent address)     │
│                             │
│  Storage:                   │
│  - owner                    │
│  - cooldown                 │
│  - pixels mapping           │
│  - lastActionTime mapping   │
└──────────────┬──────────────┘
               │ delegatecall
               ▼
┌─────────────────────────────┐
│   Implementation Contract   │
│     (swappable logic)       │
│                             │
│  - placePixel()             │
│  - getPixel()               │
│  - getAllPixels()           │
│  - setCooldown()            │
│  - etc.                     │
└─────────────────────────────┘
```

**On upgrade**: Deploy new implementation → point proxy to it → all data preserved.

---

## Current Contract State Variables

These must be preserved in exact order in all future versions:

```solidity
// Storage slot layout (DO NOT CHANGE ORDER)
address public owner;                              // slot 0
uint256 public cooldown;                           // slot 1
mapping(uint256 => Pixel) public pixels;           // slot 2
mapping(address => uint256) public lastActionTime; // slot 3
```

---

## Implementation Steps

### Step 1: Install OpenZeppelin Upgradeable Contracts

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit
```

### Step 2: Update `foundry.toml`

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

remappings = [
    "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/",
    "@openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/"
]
```

### Step 3: Create `src/PixelateUpgradeable.sol`

```solidity
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
        __UUPSUpgradeable_init();
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
```

### Step 4: Create `script/DeployUpgradeable.s.sol`

```solidity
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
```

### Step 5: Create `script/UpgradePixelate.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PixelateUpgradeable} from "../src/PixelateUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract UpgradePixelate is Script {
    function run(address proxyAddress) public {
        vm.startBroadcast();

        // 1. Deploy new implementation
        PixelateUpgradeable newImplementation = new PixelateUpgradeable();
        console.log("New implementation deployed at:", address(newImplementation));

        // 2. Upgrade proxy to point to new implementation
        UUPSUpgradeable proxy = UUPSUpgradeable(proxyAddress);
        proxy.upgradeToAndCall(address(newImplementation), "");

        console.log("Proxy upgraded successfully!");
        console.log("Proxy address (unchanged):", proxyAddress);

        vm.stopBroadcast();
    }
}
```

---

## Deployment Commands

### Initial Deployment

```bash
# Deploy to Base Sepolia testnet
forge script script/DeployUpgradeable.s.sol:DeployUpgradeable \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast

# Verify contracts (optional but recommended)
forge verify-contract <IMPLEMENTATION_ADDRESS> PixelateUpgradeable \
  --chain base-sepolia \
  --etherscan-api-key $BASESCAN_API_KEY

forge verify-contract <PROXY_ADDRESS> ERC1967Proxy \
  --chain base-sepolia \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Future Upgrades

```bash
# Deploy new implementation and upgrade proxy
forge script script/UpgradePixelate.s.sol:UpgradePixelate \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --sig "run(address)" \
  <PROXY_ADDRESS> \
  --broadcast
```

---

## Storage Layout Rules

### Allowed in V2, V3, etc.

- Add new state variables **at the end**
- Add new functions
- Modify existing function logic
- Add new events/errors
- Change constants (they're not stored)

### Forbidden (will corrupt data)

- Remove existing state variables
- Reorder state variables
- Change variable types
- Insert variables in the middle

### Example: Valid V2 Upgrade

```solidity
contract PixelateUpgradeableV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // === Original variables (UNCHANGED) ===
    uint256 public cooldown;
    mapping(uint256 => Pixel) public pixels;
    mapping(address => uint256) public lastActionTime;

    // === New variables (ADDED AT END) ===
    uint256 public totalPixelsPlaced;        // NEW - OK!
    mapping(address => uint256) public score; // NEW - OK!

    // ... rest of contract
}
```

---

## File Structure After Implementation

```
contracts/
├── src/
│   ├── Pixelate.sol                 # Original (keep for reference)
│   └── PixelateUpgradeable.sol      # New upgradeable version
├── script/
│   ├── Pixelate.s.sol               # Original deploy
│   ├── DeployUpgradeable.s.sol      # Proxy deployment
│   └── UpgradePixelate.s.sol        # Future upgrades
├── test/
│   ├── Pixelate.t.sol
│   └── PixelateUpgradeable.t.sol    # Upgrade tests
├── lib/
│   ├── openzeppelin-contracts/
│   └── openzeppelin-contracts-upgradeable/  # NEW
└── foundry.toml
```

---

## Checklist

- [ ] Run `forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit`
- [ ] Update `foundry.toml` with new remapping
- [ ] Create `PixelateUpgradeable.sol`
- [ ] Create `DeployUpgradeable.s.sol`
- [ ] Create `UpgradePixelate.s.sol`
- [ ] Write tests for upgradeable contract
- [ ] Deploy to testnet
- [ ] Test upgrade flow on testnet
- [ ] Update frontend to use proxy address
- [ ] Document proxy and implementation addresses

---

## Security Notes

1. **Secure the owner key** - Owner can upgrade to any implementation
2. **Test upgrades on testnet first** - Always verify upgrade path works
3. **Keep implementation addresses** - Record all deployed implementations
4. **Consider adding timelock** - For production, delay upgrades by 24-48 hours
5. **Verify on block explorer** - Verify both proxy and implementation contracts
