/**
 * USDT Contract ETH Mainnet
 *
 * 0xdAC17F958D2ee523a2206206994597C13D831ec7
 */

import { ethers } from 'ethers';

export const USDT_PATH = `convert-cash-usdt`;
export const USDT_ADDRESS = `0xdAC17F958D2ee523a2206206994597C13D831ec7`;

export const explorerBase = 'https://etherscan.io';
export const provider = new ethers.JsonRpcProvider(
    'https://gateway.tenderly.co/public/mainnet',
);

export const getBalance = (address) => provider.getBalance(address);
export async function getTokenBalance(address, tokenAddress) {
    const erc20Interface = new ethers.Interface([
        'function balanceOf(address owner) view returns (uint256)',
    ]);

    const calldata = erc20Interface.encodeFunctionData('balanceOf', [address]);

    const res = await provider.call({
        to: tokenAddress,
        data: calldata,
    });
    const balanceRaw = ethers.AbiCoder.defaultAbiCoder().decode(
        ['uint256'],
        res,
    )[0];

    return balanceRaw.toString();
}

/**
 *
 * Older notes for reference
 * 
 * 

// setup for pyusd <> usdc swaps on sepolia
export const USDC_PATH = 'convert-cash-usdc';
export const PYUSD_PATH = 'convert-cash-pyusd';
export const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
export const PYUSD_ADDRESS = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9';

 *
 * Sepolia USDC Faucet (Circle):
 * https://faucet.circle.com/
 *
 * USDC Contract Sepolia: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
 *
 * Ethereum Sepolia PYUSD Faucet (Google):
 * https://cloud.google.com/application/web3/faucet/ethereum/sepolia/pyusd
 *
 * PYUSD Contract Sepolia: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9
 *
 * Worker Agent Addresses:
 *
 * USDC: 0x6353b4bc8d706da77ae26e9d5a5618d98b3581cd
 * PYUSD: 0x5bb67d300f7b73b3b456d8dea30ee78b7de977bf
 */
