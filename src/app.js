import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { contractCall, contractView } from '@neardefi/shade-agent-js';

// project imports
import { verifyIntent, getTokenTx } from './evm.js';
import { getEvmAddress, ETH_USDT_ADDRESS } from './evm.js';

// project constants
const TRON_ETH_USDT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRON_CHAIN_ID = 728126428;

// server setup
const PORT = 3000;
const app = new Hono();
app.use('/*', cors());

app.get('/api/evm-address', async (c) => {
    const { address, publicKey } = await getEvmAddress();
    return c.json({ address, publicKey });
});

// static page for making the intent
app.use('/deposit/*', serveStatic({ root: './' }));

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
        methodName: 'get_intents',
        args: {},
    });

    if (getIntentsRes.find((d) => d.hash === deposit_tx_hash)) {
        return c.json({ isVerified, error: 'intent already exists' });
    }
    console.log('getIntentsRes', getIntentsRes);

    // check if intent transaction is on chain
    const { address } = await getEvmAddress();
    const tx = await getTokenTx(deposit_tx_hash);
    console.log('tx', tx);
    console.log('tx', senderAddress, address, ETH_USDT_ADDRESS);
    if (
        !tx ||
        tx.from.toLowerCase() !== senderAddress.toLowerCase() ||
        tx.to.toLowerCase() !== address.toLowerCase() ||
        tx.tokenAddress.toLowerCase() !== ETH_USDT_ADDRESS.toLowerCase()
    ) {
        return c.json({
            isVerified,
            msg: 'deposit transaction not found',
            txs: [],
        });
    }

    // submit intent to contract
    let submitted = false,
        error = null;
    try {
        await contractCall({
            methodName: 'new_intent',
            args: {
                amount: tx.amount,
                deposit_hash: deposit_tx_hash,
                src_token_address: ETH_USDT_ADDRESS,
                src_chain_id: 1,
                dest_token_address: TRON_ETH_USDT_ADDRESS,
                dest_chain_id: TRON_CHAIN_ID,
                dest_receiver_address: dest_address,
            },
        });
        submitted = true;
    } catch (e) {
        console.error('Error submitting intent:', e.message);
        error = /already exists/.test(e.message)
            ? 'intent already exists'
            : e.message;
    }

    // happy path is submitted is true and isVerified is true
    return c.json({ isVerified, submitted, error });
});

// start the server

console.log('Server listening on port: ', PORT);

serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
});
