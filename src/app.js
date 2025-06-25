import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import {
    contractCall,
    contractView,
    getAgentAccount,
    signWithAgent,
} from '@neardefi/shade-agent-js';
// project imports
import { sendETH, sendTokens } from './evm-send.js';
import { getHistoricalTransactionsTo } from './evm-receive.js';
import { genAddress, addCron, sleep } from './utils.js';
import { getBalance, getTokenBalance, USDT_ADDRESS, USDT_PATH } from './evm.js';

const PORT = 3000;

const app = new Hono();

app.use('/*', cors());

// addresses

app.get('/api/address/agent', async (c) => {
    const res = await getAgentAccount();
    return c.json(res);
});

// helper

async function getTokenDetails(c) {
    let path = USDT_PATH,
        tokenAddress = USDT_ADDRESS;
    const { address } = await genAddress(path);
    return { path, address, tokenAddress };
}

// api for each token account usdc and pyusd

app.get('/api/address', async (c) => {
    const { address } = await getTokenDetails(c);
    return c.json({ address });
});

app.get('/api/balance', async (c) => {
    const { address, tokenAddress } = await getTokenDetails(c);
    const balance = await getTokenBalance(address, tokenAddress);
    return c.json({ balance });
});

app.get('/api/drain', async (c) => {
    const { path, address, tokenAddress } = await getTokenDetails(c);
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

// start the cron job when server starts

async function startCron() {
    const { address: USDT_ACCOUNT } = await genAddress(USDT_PATH);

    addCron(async () => {
        const txs = await getHistoricalTransactionsTo(USDT_ACCOUNT);
        txs.forEach((tx) => {
            sendTokens({
                tokenAddress: USDT_ADDRESS,
                sender: USDT_ACCOUNT,
                receiver: tx.from,
                amount: parseInt(tx.value),
            });
        });
    });
}

startCron();

console.log('Server listening on port: ', PORT);

serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
});
