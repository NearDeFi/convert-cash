const { ETHERSCAN_API_KEY } = process.env;
import { provider } from './evm.js';

const CONFIRMATIONS = 2;
const seenTXs = [];

export async function getHistoricalTransactionsTo(address) {
    const blockNumber = await provider.getBlockNumber();

    const url = `https://api-sepolia.etherscan.io/api?module=account
	&action=tokentx
	&address=${address}
	&sort=desc
	&startblock=${blockNumber - 5}
	&endblock=${blockNumber}
	&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.result.length === 0) return [];

    // filter results
    const filtered = data.result.filter(
        (tx) =>
            tx.to?.toLowerCase() === address.toLowerCase() &&
            parseInt(tx.confirmations) > CONFIRMATIONS &&
            !seenTXs.includes(tx.hash),
    );
    // try and swap, so ignore this tx in future results
    filtered.forEach((tx) => seenTXs.push(tx.hash));

    return filtered;
}

/** 
 * Sample Response
 * 
[
  {
    blockNumber: '8578760',
    timeStamp: '1750287240',
    hash: '0xea2dfe01e81cf1bb8751fa2061298adee280e8776f3b46a7bad7abbb1de83d24',
    nonce: '34',
    blockHash: '0x68537b38c140a9da3529ffbd074cc28151900a63492c9807585cd857fdef80c7',
    from: '0x525521d79134822a342d330bd91da67976569af1',
    contractAddress: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    to: '0x6353b4bc8d706da77ae26e9d5a5618d98b3581cd',
    value: '4000000',
    tokenName: 'USDC',
    tokenSymbol: 'USDC',
    tokenDecimal: '6',
    transactionIndex: '13',
    gas: '94464',
    gasPrice: '1500000625',
    gasUsed: '62147',
    cumulativeGasUsed: '983562',
    input: 'deprecated',
    methodId: '0xa9059cbb',
    functionName: 'transfer(address to, uint256 amount)',
    confirmations: '4'
  }
]
*/
