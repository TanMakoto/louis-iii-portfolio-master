/**
 * blockchain.js - JIBCHAIN Data Integration for JIBCHAIN Defender
 */

const RPC_URL = 'https://rpc-l1.jibchain.net';

export async function getLatestBlock() {
    try {
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1
            })
        });
        const data = await response.json();
        const blockNumber = parseInt(data.result, 16);

        // Update UI
        const blockVal = document.getElementById('block-val');
        if (blockVal) blockVal.textContent = `#${blockNumber}`;

        // Get Block Details for random seed
        const blockResponse = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getBlockByNumber',
                params: [data.result, false],
                id: 2
            })
        });
        const blockData = await blockResponse.json();
        return blockData.result;
    } catch (error) {
        console.error('Error fetching JIBCHAIN data:', error);
        return null;
    }
}

// Polling for block updates
setInterval(() => {
    getLatestBlock();
}, 10000);

getLatestBlock();
