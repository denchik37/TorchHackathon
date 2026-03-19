// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Minimal ERC-20 for unit/integration tests.
 *         Allows setting decimals (Hedera tokens often use non-18 decimals).
 */
contract MockERC20 is ERC20 {
    uint8 private _tokenDecimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name_, symbol_) {
        require(decimals_ > 0, "decimals == 0");
        _tokenDecimals = decimals_;
        _mint(msg.sender, initialSupply);
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }
}

