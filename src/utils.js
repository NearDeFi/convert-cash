import { generateAddress } from '@neardefi/shade-agent-js';

const { MPC_PUBLIC_KEY: publicKey, NEXT_PUBLIC_contractId: accountId } =
    process.env;
const chain = 'evm';

export const sleep = (dur) => new Promise((r) => setTimeout(r, dur));

// helper for generate derived address

export const genAddress = (path) =>
    generateAddress({
        publicKey,
        accountId,
        path,
        chain,
    });

// active cron it setup is called

const CRON_TIMEOUT = 10000; // 12s blocks
let CRON_FUNCTIONS = [];

export function addCron(func) {
    CRON_FUNCTIONS.push(func);
    return CRON_FUNCTIONS.length - 1;
}

export function removeCron(index) {
    CRON_FUNCTIONS.splice(index, 1);
}

function cron() {
    if (CRON_FUNCTIONS.length === 0) {
        return setTimeout(cron, CRON_TIMEOUT);
    }
    CRON_FUNCTIONS.forEach((func) => func());
    setTimeout(cron, CRON_TIMEOUT);
}

cron();
