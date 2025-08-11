import { ethers, Interface, getAddress, verifyTypedData } from 'ethers';
import { baseDecode } from '@near-js/utils';
import { viewFunction } from './near.js';
import keccak from 'keccak';

export const ETH_PATH = `evm-1`;
export const ETH_USDT_ADDRESS = `0xdAC17F958D2ee523a2206206994597C13D831ec7`;
export const ETH_CHAIN_ID = 1;

export const explorerBase = 'https://etherscan.io';
export const provider = new ethers.JsonRpcProvider(
    'https://gateway.tenderly.co/public/mainnet',
);

export async function getEvmAddress() {
    const derivedPublicKey = await viewFunction({
        contractId: 'v1.signer',
        methodName: 'derived_public_key',
        args: {
            path: ETH_PATH,
            predecessor: 'ac-proxy.shadeagent.near',
            domain_id: 0,
        },
    });

    const publicKey = baseDecode(derivedPublicKey.split(':')[1]);
    const addressBytes = keccak('keccak256')
        .update(Buffer.from(publicKey))
        .digest()
        .slice(-20);
    const address = '0x' + addressBytes.toString('hex');
    console.log(address);

    return { address, publicKey };
}

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

export async function verifyIntent({ address, message, signature }) {
    console.log(`Verifying deposit from address: ${address}...`);

    const domain = {
        name: 'Sign Example',
        version: '1',
        chainId: 1,
    };
    const types = {
        SignRequest: [
            { name: 'deposit_tx_hash', type: 'string' },
            { name: 'dest_address', type: 'string' },
        ],
    };

    // Recover the signer address
    const signerAddress = verifyTypedData(domain, types, message, signature);

    return getAddress(signerAddress) === getAddress(address);
}

export async function getTokenTx(txHash) {
    // ERC-20 Transfer event ABI
    const ERC20_ABI = [
        'event Transfer(address indexed from, address indexed to, uint256 value)',
    ];
    // Get transaction and receipt
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
        return null;
    }
    const receipt = await provider.getTransactionReceipt(txHash);

    // Prepare the ERC20 iface for decoding logs
    const iface = new Interface(ERC20_ABI);

    // Filter transfer logs (ERC20)
    const transferLogs = receipt.logs
        .map((log) => {
            try {
                const parsed = iface.parseLog(log);
                if (parsed.name === 'Transfer') {
                    return { ...parsed, address: log.address };
                }
            } catch (e) {}
            return null;
        })
        .filter((log) => log);

    if (transferLogs.length === 0) {
        return null;
    }

    // If there's more than one, you may need to add logic to select the right one.
    // Here, we just return the first.
    const log = transferLogs[0];

    // Get token contract, sender, receiver, and value
    const tokenAddress = log.address;
    const [from, to, value] = log.args;

    // Get decimals for pretty amount
    const amount = value.toString();

    return {
        amount,
        tokenAddress,
        from,
        to,
    };
}
