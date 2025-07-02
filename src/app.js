import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { createHash, verify } from 'node:crypto';
import {
    getAccount,
    contractCall,
    contractView,
    getAgentAccount,
    signWithAgent,
} from '@neardefi/shade-agent-js';
// project imports
import { sendETH, sendTokens } from './evm-send.js';
import { verifyIntent, getTokenTx } from './evm-receive.js';
import { genAddress } from './utils.js';
import { getBalance, getTokenBalance, USDT_ADDRESS, USDT_PATH } from './evm.js';
import { TRON_USDT_ADDRESS, TRON_CHAIN_ID } from './tron.js';

// server setup

const PORT = 3000;

const app = new Hono();

app.use('/*', cors());

app.use('/static/*', serveStatic({ root: './' }));

app.post('/api/verifyIntent', async (c) => {
    const args = await c.req.json();

    // check signature is valid
    const isVerified = await verifyIntent(args);
    if (!isVerified) {
        return c.json({ isVerified });
    }

    // unpack args
    const {
        address: senderAddress,
        message: { deposit_tx_hash, dest_address },
    } = args;

    // check contract to see if intent already exists
    const getIntentsRes = await contractView({
        methodName: 'get_new_intents',
        args: {},
    });

    if (getIntentsRes.find((d) => d.hash === deposit_tx_hash)) {
        return c.json({ isVerified, error: 'intent already exists' });
    }
    console.log('getIntentsRes', getIntentsRes);

    // check if intent transaction is on chain
    const { address, tokenAddress } = await getTokenDetails(); // USDT deposit address on Ethereum mainnet
    const tx = await getTokenTx(deposit_tx_hash);
    console.log('tx', tx);
    console.log('tx', senderAddress, address, tokenAddress);
    if (
        !tx ||
        tx.from.toLowerCase() !== senderAddress.toLowerCase() ||
        tx.to.toLowerCase() !== address.toLowerCase() ||
        tx.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase()
    ) {
        return c.json({
            isVerified,
            msg: 'deposit transaction not found',
            txs: [],
        });
    }

    // submit intent to contract
    let sumitted, error;
    try {
        await contractCall({
            methodName: 'new_intent',
            args: {
                amount: tx.amount,
                hash: deposit_tx_hash,
                src_token_address: USDT_ADDRESS,
                src_chain_id: 1,
                dest_token_address: TRON_USDT_ADDRESS,
                dest_chain_id: TRON_CHAIN_ID,
                dest_receiver_address: dest_address,
            },
        });
        sumitted = true;
    } catch (e) {
        console.error('Error submitting intent:', e.message);
        error = /already exists/.test(e.message)
            ? 'intent already exists'
            : e.message;
    }

    // happy path is submitted is true and isVerified is true
    return c.json({ isVerified, submitted, error });
});

// addresses

app.get('/api/address/agent', async (c) => {
    const res = await getAgentAccount();
    return c.json(res);
});

// helper

async function getTokenDetails() {
    let path = USDT_PATH,
        tokenAddress = USDT_ADDRESS;
    const { address } = await genAddress(path);
    return { path, address, tokenAddress };
}

// api for controlling tokens on Ethereum mainnet

app.get('/api/address', async (c) => {
    const { address } = await getTokenDetails();
    return c.json({ address });
});

app.get('/api/balance', async (c) => {
    const { address, tokenAddress } = await getTokenDetails();
    const balance = await getTokenBalance(address, tokenAddress);
    return c.json({ balance });
});

app.get('/api/drain', async (c) => {
    const { path, address, tokenAddress } = await getTokenDetails();
    const balance = await getTokenBalance(address, tokenAddress);

    const res = await sendTokens({
        path: path,
        tokenAddress: tokenAddress,
        sender: address,
        amount: BigInt(balance),
    });

    return c.json({ res });
});

app.get('/api/drain-eth', async (c) => {
    const { path, address } = await getTokenDetails(c);
    const balance = await getBalance(address);

    const res = await sendETH({
        path: path,
        sender: address,
        amount: BigInt(balance),
    });

    return c.json({ res });
});

console.log('Server listening on port: ', PORT);

serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
});
