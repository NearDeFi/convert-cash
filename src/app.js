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
import { sendTokens } from './evm-send.js';
import { getHistoricalTransactionsTo } from './evm-receive.js';
import { genAddress, addCron, sleep } from './utils.js';
import {
    getTokenBalance,
    USDC_ADDRESS,
    USDC_PATH,
    PYUSD_ADDRESS,
    PYUSD_PATH,
} from './evm.js';

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
    const what = c.req.param('what');
    let path = USDC_PATH,
        tokenAddress = USDC_ADDRESS;
    if (what === 'pyusd') {
        path = PYUSD_PATH;
        tokenAddress = PYUSD_ADDRESS;
    }
    const { address } = await genAddress(path);
    return { path, address, tokenAddress };
}

// api for each token account usdc and pyusd

app.get('/api/address/:what', async (c) => {
    const { address } = await getTokenDetails(c);
    return c.json({ address });
});

app.get('/api/balance/:what', async (c) => {
    const { address, tokenAddress } = await getTokenDetails(c);
    const balance = await getTokenBalance(address, tokenAddress);
    return c.json({ balance });
});

app.get('/api/drain/:what', async (c) => {
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

// start the cron job when server starts

async function startCron() {
    const { address: PYUSD_ACCOUNT } = await genAddress(PYUSD_PATH);
    const { address: USDC_ACCOUNT } = await genAddress(USDC_PATH);

    addCron(async () => {
        const txs = await getHistoricalTransactionsTo(USDC_ACCOUNT);
        txs.forEach(async (tx) => {
            const evm_address = tx.from;
            const token_address = USDC_ADDRESS;
            const amount = tx.value;

            await contractCall({
                methodName: 'set_deposit',
                args: {
                    evm_address,
                    token_address,
                    amount,
                },
            });

            await sleep(1000);

            const depositRes = await contractView({
                methodName: 'get_deposit',
                args: {
                    evm_address,
                },
            });

            console.log('depositRes', depositRes);
        });
    });

    await sleep(1000);

    addCron(async () => {
        const txs = await getHistoricalTransactionsTo(PYUSD_ACCOUNT);
        txs.forEach((tx) => {
            sendTokens({
                path: USDC_PATH,
                tokenAddress: USDC_ADDRESS,
                sender: USDC_ACCOUNT,
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
