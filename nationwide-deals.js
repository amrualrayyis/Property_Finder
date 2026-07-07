const axios = require('axios');

async function findNationwideDeals() {
    console.log('--- 🌎 Finding Best Nationwide Property Deals (Live APIs) ---');
    
    const deals = [];

    // 1. Howard County, MD (High detailed data)
    try {
        console.log('Querying Howard County, MD...');
        const res = await axios.get('https://opendata.howardcountymd.gov/resource/etp2-fnbu.json?$limit=50');
        res.data.forEach(item => {
            const value = parseFloat(item.assessed_value) || 0;
            const debt = parseFloat(item.total_due) || 1;
            const ratio = value / debt;
            
            if (value > 50000 && debt < 5000) {
                deals.push({
                    location: 'Howard County, MD',
                    id: item.parcel,
                    address: 'Lookup Parcel ID',
                    value: value,
                    debt: debt,
                    equity: value - debt,
                    ratio: ratio.toFixed(1),
                    contact: 'Howard County Finance: 410-313-2062'
                });
            }
        });
    } catch (e) { console.log('Howard County API error'); }

    // 2. Richmond, VA
    try {
        console.log('Querying Richmond, VA...');
        const res = await axios.get('https://data.richmondgov.com/resource/83t5-hbac.json?$limit=50');
        res.data.forEach(item => {
            const debt = parseFloat(item.total_due) || 0;
            if (debt > 500 && debt < 3000 && parseInt(item.total_years_del) > 5) {
                deals.push({
                    location: 'Richmond, VA',
                    id: item.property_code,
                    address: item.physical_address,
                    value: 'TBD (High Delinquency)',
                    debt: debt,
                    equity: 'Unknown',
                    ratio: 'N/A',
                    contact: 'Richmond Tax Collector: 804-646-7000'
                });
            }
        });
    } catch (e) { console.log('Richmond API error'); }

    // 3. Norfolk, VA
    try {
        console.log('Querying Norfolk, VA...');
        const res = await axios.get('https://data.norfolk.gov/resource/7qie-z5gv.json?$limit=50');
        res.data.forEach(item => {
            const debt = parseFloat(item.total_due) || 0;
            if (debt > 500 && debt < 5000) {
                deals.push({
                    location: 'Norfolk, VA',
                    id: item.parcel_id,
                    address: item.property_address,
                    value: 'TBD',
                    debt: debt,
                    equity: 'Unknown',
                    ratio: 'N/A',
                    contact: 'Norfolk Treasurer: 757-664-7800'
                });
            }
        });
    } catch (e) { console.log('Norfolk API error'); }

    // Sort each source individually
    const finalSelection = [];
    
    const mdDeals = deals.filter(d => d.location.includes('MD')).sort((a, b) => b.ratio - a.ratio).slice(0, 2);
    const vaDeals = deals.filter(d => d.location.includes('VA')).sort((a, b) => b.debt - a.debt).slice(0, 3);
    
    finalSelection.push(...mdDeals, ...vaDeals);

    console.log('\n--- 🏆 NATIONWIDE "SILVER PLATTER" DEALS ---');
    finalSelection.forEach((d, i) => {
        console.log(`\n[${i+1}] ${d.location} - ID: ${d.id}`);
        console.log(`    Address:      ${d.address}`);
        if (d.value !== 'TBD (High Delinquency)' && d.value !== 'TBD') {
            console.log(`    Market Value: $${d.value.toLocaleString()}`);
            console.log(`    Equity Ratio: ${d.ratio}x`);
        }
        console.log(`    Total Debt:   $${d.debt.toLocaleString()}`);
        console.log(`    How to Buy:   Call ${d.contact}`);
    });
}

findNationwideDeals();
