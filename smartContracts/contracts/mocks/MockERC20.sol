// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev Unrestricted mint for tests and local tooling (not for production)
 */
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Collateral", "MCOL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
