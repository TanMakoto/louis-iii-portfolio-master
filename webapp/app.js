import { createPublicClient, http } from 'https://esm.sh/viem';

// Configuration
const jibchain = {
    id: 8899,
    name: 'JIBCHAIN L1',
    network: 'jibchain',
    nativeCurrency: {
        decimals: 18,
        name: 'JBC',
        symbol: 'JBC',
    },
    rpcUrls: {
        default: { http: ['https://rpc-l1.jibchain.net'] },
        public: { http: ['https://rpc-l1.jibchain.net'] },
    },
    blockExplorers: {
        default: { name: 'JIBCHAIN Explorer', url: 'https://exp.jibchain.net' },
    },
};

const client = createPublicClient({
    chain: jibchain,
    transport: http()
});

const FACTORY_ADDRESS = '0x63bB41b79b5aAc6e98C7b35Dcb0fE941b85Ba5Bb';
const STORE_ADDRESS = '0x0994Bc66b2863f8D58C8185b1ed6147895632812'; // Defaulting to FloodBoy016
const UNIVERSAL_SIGNER = '0xcB0e58b011924e049ce4b4D62298Edf43dFF0BDd';

let FactoryABI = [];
let StoreABI = [];
let chartInstance = null;
let historicalData = []; // Store fetched data
let activeChartType = 'waterDepth'; // 'waterDepth' or 'batteryVoltage'

// Elements
const el = {
    storeNickname: document.getElementById('storeNickname'),
    storeDescription: document.getElementById('storeDescription'),
    currentBlock: document.getElementById('currentBlock'),
    lastUpdated: document.getElementById('lastUpdated'),
    storeLink: document.getElementById('storeLink'),
    storeAddress: document.getElementById('storeAddress'),
    toggleWater: document.getElementById('toggleWater'),
    toggleVoltage: document.getElementById('toggleVoltage'),
    dataTableBody: document.getElementById('dataTableBody'),
    footerUpdated: document.getElementById('footerUpdated'),
    ownerLink: document.getElementById('ownerLink'),
    deployedBlockLink: document.getElementById('deployedBlockLink'),
    sensorCount: document.getElementById('sensorCount'),
    chartLoader: document.getElementById('chartLoader'),
    chartError: document.getElementById('chartError'),
    groupingInterval: document.getElementById('groupingInterval')
};

// Formatting Utilities
function formatFieldName(fieldName) {
    return fieldName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function truncateAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

// Data Processing according to Prompt Rules
function processValue(value, unitStr) {
    const val = Number(value);
    const baseUnitMatch = unitStr.match(/^([a-zA-Z]+)\s*x/);
    const baseUnit = baseUnitMatch ? baseUnitMatch[1] : unitStr;

    if (unitStr.includes('x10000')) {
        return { val: val / 10000, display: (val / 10000).toFixed(4) + ' ' + baseUnit };
    } else if (unitStr.includes('x1000')) {
        return { val: val / 1000, display: (val / 1000).toFixed(3) + ' ' + baseUnit };
    } else if (unitStr.includes('x100')) {
        return { val: val / 100, display: (val / 100).toFixed(3) + ' ' + baseUnit };
    }
    return { val: val, display: val + ' ' + unitStr };
}

async function loadABIs() {
    try {
        const factoryRes = await fetch('./abis/CatLabFactory.json');
        FactoryABI = await factoryRes.json();
        const storeRes = await fetch('./abis/CatLabSecureSensorStore.abi.json');
        StoreABI = await storeRes.json();
    } catch (e) {
        showError("Failed to load ABI files.");
        console.error(e);
    }
}

async function fetchStoreInfo() {
    try {
        const [nickname, owner, sensorCount, deployedBlock, description] = await client.readContract({
            address: FACTORY_ADDRESS,
            abi: FactoryABI,
            functionName: 'getStoreInfo',
            args: [STORE_ADDRESS]
        });

        const currentBlock = await client.getBlockNumber();
        const now = new Date();

        // Update Header & Meta
        el.storeNickname.textContent = nickname;
        el.storeDescription.textContent = description;
        el.currentBlock.textContent = `Current Block: ${currentBlock.toString()}`;

        const timestampStr = now.toLocaleDateString() + ', ' + now.toLocaleTimeString();
        el.lastUpdated.textContent = `Last Updated: ${now.toLocaleTimeString()}`;
        el.footerUpdated.textContent = `Last Updated: ${timestampStr}`;

        el.storeAddress.textContent = truncateAddress(STORE_ADDRESS);
        el.storeLink.href = `${jibchain.blockExplorers.default.url}/address/${STORE_ADDRESS}`;

        el.ownerLink.textContent = truncateAddress(owner);
        el.ownerLink.href = `${jibchain.blockExplorers.default.url}/address/${owner}`;

        el.deployedBlockLink.textContent = `#${deployedBlock}`;
        el.deployedBlockLink.href = `${jibchain.blockExplorers.default.url}/block/${deployedBlock}`;

        el.sensorCount.textContent = `Sensor Count: ${sensorCount} authorized sensor${sensorCount > 1 ? 's' : ''}`;

    } catch (e) {
        showError("Failed to fetch store information.");
        console.error(e);
    }
}

async function fetchData() {
    try {
        el.chartLoader.style.display = 'flex';
        el.chartError.style.display = 'none';

        const fields = await client.readContract({
            address: STORE_ADDRESS,
            abi: StoreABI,
            functionName: 'getAllFields'
        });

        // Current Block for events
        const currentBlockNumber = await client.getBlockNumber();
        const fromBlock = currentBlockNumber - BigInt(28800); // approx 24h

        const events = await client.getContractEvents({
            address: STORE_ADDRESS,
            abi: StoreABI,
            eventName: 'RecordStored',
            fromBlock: fromBlock,
            toBlock: 'latest',
            args: { sensor: UNIVERSAL_SIGNER }
        });

        if (events.length === 0) {
            showError("No historical data available for the last 24 hours.");
            el.dataTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No data available</td></tr>';
            return;
        }

        processEventsAndRender(fields, events);

    } catch (e) {
        showError("Failed to fetch sensor data: " + e.message);
        console.error(e);
    } finally {
        el.chartLoader.style.display = 'none';
    }
}

function processEventsAndRender(fields, events) {
    const waterDepthIdx = fields.findIndex(f => f.name.toLowerCase().includes('water_depth') && !f.name.toLowerCase().includes('min') && !f.name.toLowerCase().includes('max'));
    const batteryVoltageIdx = fields.findIndex(f => f.name.toLowerCase().includes('battery_voltage') && !f.name.toLowerCase().includes('min') && !f.name.toLowerCase().includes('max'));

    // Process all raw events
    const rawData = events.map(e => ({
        timestamp: Number(e.args.timestamp) * 1000,
        waterDepth: waterDepthIdx >= 0 ? processValue(e.args.values[waterDepthIdx], fields[waterDepthIdx].unit).val : null,
        batteryVoltage: batteryVoltageIdx >= 0 ? processValue(e.args.values[batteryVoltageIdx], fields[batteryVoltageIdx].unit).val : null,
        rawValues: e.args.values
    })).sort((a, b) => a.timestamp - b.timestamp);

    // Grouping and Smoothing
    const intervalMins = parseInt(el.groupingInterval.value);
    historicalData = groupAndSmoothData(rawData, intervalMins);

    renderChart();
    renderTable(fields, historicalData, rawData);
}

function groupAndSmoothData(rawData, intervalMins) {
    if (rawData.length === 0) return [];

    const intervalMs = intervalMins * 60 * 1000;
    const grouped = [];

    let currentGroupStart = Math.floor(rawData[0].timestamp / intervalMs) * intervalMs;
    let currentGroup = [];

    for (const dp of rawData) {
        if (dp.timestamp >= currentGroupStart + intervalMs) {
            if (currentGroup.length > 0) grouped.push(averageGroup(currentGroupStart, currentGroup));
            currentGroupStart = Math.floor(dp.timestamp / intervalMs) * intervalMs;
            currentGroup = [];
        }
        currentGroup.push(dp);
    }
    if (currentGroup.length > 0) grouped.push(averageGroup(currentGroupStart, currentGroup));

    // Simple moving average smoothing (window = 3) for visual
    if (grouped.length >= 3) {
        for (let i = 1; i < grouped.length - 1; i++) {
            grouped[i].smoothWaterDepth = (grouped[i - 1].waterDepth + grouped[i].waterDepth + grouped[i + 1].waterDepth) / 3;
            grouped[i].smoothBatteryVoltage = (grouped[i - 1].batteryVoltage + grouped[i].batteryVoltage + grouped[i + 1].batteryVoltage) / 3;
        }
        grouped[0].smoothWaterDepth = grouped[0].waterDepth;
        grouped[0].smoothBatteryVoltage = grouped[0].batteryVoltage;
        grouped[grouped.length - 1].smoothWaterDepth = grouped[grouped.length - 1].waterDepth;
        grouped[grouped.length - 1].smoothBatteryVoltage = grouped[grouped.length - 1].batteryVoltage;
    } else {
        grouped.forEach(g => {
            g.smoothWaterDepth = g.waterDepth;
            g.smoothBatteryVoltage = g.batteryVoltage;
        });
    }

    return grouped;
}

function averageGroup(timestampStart, group) {
    const sum = group.reduce((acc, curr) => ({
        w: acc.w + (curr.waterDepth || 0),
        b: acc.b + (curr.batteryVoltage || 0)
    }), { w: 0, b: 0 });
    return {
        timestamp: timestampStart + (group[group.length - 1].timestamp - timestampStart) / 2, // Midpoint
        waterDepth: sum.w / group.length,
        batteryVoltage: sum.b / group.length,
        sampleCount: group.length
    };
}

function renderChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    let labels = historicalData.map(d => new Date(d.timestamp));
    let dataset = [];

    if (activeChartType === 'waterDepth') {
        dataset = [{
            label: 'Water Depth (m)',
            data: historicalData.map(d => d.smoothWaterDepth),
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 1,
            pointHoverRadius: 5
        }];
    } else {
        dataset = [{
            label: 'Battery Voltage (V)',
            data: historicalData.map(d => d.smoothBatteryVoltage),
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 1,
            pointHoverRadius: 5
        }];
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: dataset
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(4); // Keep precision
                            }
                            // Add sample count from data
                            const dataIdx = context.dataIndex;
                            if (historicalData[dataIdx] && historicalData[dataIdx].sampleCount) {
                                label += ` (${historicalData[dataIdx].sampleCount} samples)`;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        displayFormats: {
                            hour: 'HH:mm'
                        }
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: activeChartType === 'waterDepth' ? 'Meters (m)' : 'Volts (V)'
                    }
                }
            }
        }
    });

    // Update buttons
    el.toggleWater.classList.toggle('active', activeChartType === 'waterDepth');
    el.toggleVoltage.classList.toggle('active', activeChartType === 'batteryVoltage');
}

function renderTable(fields, groupedData, rawData) {
    let html = '';

    // Calculate global Min/Max from rawData for accuracy
    const calcStats = (idx) => {
        if (idx < 0) return { min: '-', max: '-' };
        // Process all raw values
        const vals = rawData.map(d => {
            const val = Number(d.rawValues[idx]);
            const unit = fields[idx].unit;
            if (unit.includes('x10000')) return val / 10000;
            if (unit.includes('x1000')) return val / 1000;
            if (unit.includes('x100')) return val / 100;
            return val;
        }).filter(v => v !== null && !isNaN(v));

        if (vals.length === 0) return { min: '-', max: '-' };
        return {
            min: Math.min(...vals),
            max: Math.max(...vals)
        };
    };

    const latestRaw = rawData[rawData.length - 1];

    fields.forEach((field, i) => {
        // Skip hidden fields or specific min/max fields in the main rows
        if (field.name.toLowerCase().includes('min') || field.name.toLowerCase().includes('max')) return;
        if (field.name.toLowerCase().includes('count')) return;

        let title = formatFieldName(field.name);

        // Find if there's a corresponding count
        const countIdx = fields.findIndex(f => f.name.toLowerCase() === field.name.toLowerCase() + '_count');
        if (countIdx >= 0 && latestRaw) {
            const countVal = Number(latestRaw.rawValues[countIdx]);
            if (!isNaN(countVal)) {
                title += ` (${countVal} samples)`;
            }
        }

        const stats = calcStats(i);
        const latestProccessed = latestRaw ? processValue(latestRaw.rawValues[i], field.unit) : null;

        let currentDisplay = latestProccessed ? latestProccessed.display : '-';

        const baseUnitMatch = field.unit.match(/^([a-zA-Z]+)\s*x/);
        const baseUnit = baseUnitMatch ? baseUnitMatch[1] : field.unit;

        let minDisplay = '-';
        let maxDisplay = '-';

        if (stats.min !== '-') {
            if (field.unit.includes('x10000')) {
                minDisplay = stats.min.toFixed(4) + ' ' + baseUnit;
                maxDisplay = stats.max.toFixed(4) + ' ' + baseUnit;
            } else if (field.unit.includes('x100')) {
                minDisplay = stats.min.toFixed(3) + ' ' + baseUnit;
                maxDisplay = stats.max.toFixed(3) + ' ' + baseUnit;
            } else {
                minDisplay = stats.min.toString() + ' ' + baseUnit;
                maxDisplay = stats.max.toString() + ' ' + baseUnit;
            }
        }

        html += `
            <tr>
                <td>${title}</td>
                <td style="font-weight: 500;">${currentDisplay}</td>
                <td style="color: var(--text-muted);">${minDisplay}</td>
                <td style="color: var(--text-muted);">${maxDisplay}</td>
            </tr>
        `;
    });

    el.dataTableBody.innerHTML = html;
}

function showError(msg) {
    el.chartError.textContent = msg;
    el.chartError.style.display = 'flex';
}

// Event Listeners
el.toggleWater.addEventListener('click', () => {
    activeChartType = 'waterDepth';
    renderChart();
});

el.toggleVoltage.addEventListener('click', () => {
    activeChartType = 'batteryVoltage';
    renderChart();
});

el.groupingInterval.addEventListener('change', () => {
    fetchData(); // Refetch to rebuild groups easily
});

// Initialization
async function init() {
    await loadABIs();
    await fetchStoreInfo();
    await fetchData();
}

init();
