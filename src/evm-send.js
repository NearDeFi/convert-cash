import { ethers } from 'ethers';
import { signWithAgent } from '@neardefi/shade-agent-js';
import { explorerBase, provider } from './evm.js';

export async function sendETH({
    path,
    sender,
    receiver = '0x525521d79134822a342d330bd91da67976569af1',
    amount = ethers.parseUnits('1.0', 6),
    chainId = 11155111,
}) {
    const { unsignedTx, payload } = await ethUnsignedTx({
        sender,
        receiver,
        amount,
        chainId,
    });

    const sigRes = await signWithAgent(path, payload);
    unsignedTx.signature = parseSignature({ sigRes });
    const res = await broadcastTransaction(unsignedTx.serialized);
    return res;
}

export async function sendTokens({
    path,
    tokenAddress,
    sender,
    receiver = '0x525521d79134822a342d330bd91da67976569af1',
    amount = ethers.parseUnits('1.0', 6),
    chainId = 11155111,
}) {
    const { unsignedTx, payload } = await erc20UnsignedTx({
        tokenAddress,
        sender,
        receiver,
        amount,
        chainId,
    });

    const sigRes = await signWithAgent(path, payload);
    unsignedTx.signature = parseSignature({ sigRes });
    const res = await broadcastTransaction(unsignedTx.serialized);
    return res;
}

export async function ethUnsignedTx({ sender, receiver, amount, chainId }) {
    // Get live network data
    const [nonce, feeData] = await Promise.all([
        provider.getTransactionCount(sender, 'latest'),
        provider.getFeeData(), // Gets current EIP-1559 gas values[1][4]
    ]);
    const gasPrice =
        (feeData.maxFeePerGas + feeData.maxPriorityFeePerGas) * BigInt('21000');
    const finalAmount = amount - gasPrice;

    const unsignedTx = ethers.Transaction.from({
        type: 2, // EIP-1559 transaction
        chainId: chainId,
        to: receiver,
        nonce, // Replace with actual sender nonce
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        maxFeePerGas: feeData.maxFeePerGas,
        gasLimit: 21000, // Estimate gas
        value: finalAmount,
    });

    const hexPayload = ethers.keccak256(
        ethers.getBytes(unsignedTx.unsignedSerialized),
    );
    const payload = [...Buffer.from(hexPayload.substring(2), 'hex')];

    return { unsignedTx, payload };
}

export async function erc20UnsignedTx({
    tokenAddress,
    sender,
    receiver,
    amount,
    chainId,
}) {
    const erc20Interface = new ethers.Interface([
        'function transfer(address to, uint256 value) returns (bool)',
    ]);

    // Get live network data
    const [nonce, feeData] = await Promise.all([
        provider.getTransactionCount(sender, 'latest'),
        provider.getFeeData(), // Gets current EIP-1559 gas values[1][4]
    ]);

    const unsignedTx = ethers.Transaction.from({
        type: 2, // EIP-1559 transaction
        chainId: chainId,
        to: ethers.getAddress(tokenAddress),
        data: erc20Interface.encodeFunctionData('transfer', [receiver, amount]),
        nonce, // Replace with actual sender nonce
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        maxFeePerGas: feeData.maxFeePerGas,
        gasLimit: 100000, // Estimate gas
        value: 0, // Zero for token transfers
    });

    const hexPayload = ethers.keccak256(
        ethers.getBytes(unsignedTx.unsignedSerialized),
    );
    const payload = [...Buffer.from(hexPayload.substring(2), 'hex')];

    return { unsignedTx, payload };
}

export function parseSignature({ sigRes, chainId = 11155111 }) {
    // parse the signature r, s, v into an ethers signature instance
    const signature = ethers.Signature.from({
        r:
            '0x' +
            Buffer.from(sigRes.big_r.affine_point.substring(2), 'hex').toString(
                'hex',
            ),
        s: '0x' + Buffer.from(sigRes.s.scalar, 'hex').toString('hex'),
        v: sigRes.recovery_id + (chainId * 2 + 35),
    });
    return signature;
}

export async function broadcastTransaction(serializedTx) {
    console.log('BROADCAST serializedTx', serializedTx);

    try {
        const hash = await provider.send('eth_sendRawTransaction', [
            serializedTx,
        ]);
        const tx = await provider.waitForTransaction(hash, 1);

        console.log('SUCCESS TX HASH:', hash);
        console.log(`EXPLORER LINK: ${explorerBase}/tx/${hash}`);

        return {
            success: true,
            tx,
            hash,
            explorerLink: `${explorerBase}/tx/${hash}`,
        };
    } catch (e) {
        console.log(e);
        return {
            success: false,
            error: e,
        };
    }
}
