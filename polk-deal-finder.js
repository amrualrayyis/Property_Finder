const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const cheerio = require('cheerio');

const TAX_DEED_CSV_URL = "https://www.polktaxes.com/downloads/taxdeed.csv";
const PCPAO_PARCEL = "https://pcpao.gov/parceldetail.aspx";

async function fetchTaxDeeds() {
    console.log('📥 Downloading tax deed applications list...');
    const response = await axios.get(TAX_DEED_CSV_URL);
    const results = [];
    
    return new Promise((resolve, reject) => {
        const Readable = require('stream').Readable;
        const s = new Readable();
        s.push(response.data);
        s.push(null);
        
        s.pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

async function fetchPcpao(parcelId) {
    const pid = parcelId.replace(/[^0-9A-Za-z]/g, '');
    try {
        const response = await axios.get(PCPAO_PARCEL, { params: { parcel: pid } });
        const $ = cheerio.load(response.data);
        
        const getValue = (label) => {
            const el = $(`td:contains("${label}")`).next('td');
            return parseFloat(el.text().replace(/[^0-9.]/g, '')) || 0;
        };

        const getText = (label) => {
            const el = $(`td:contains("${label}")`).next('td');
            return el.text().trim();
        };

        return {
            land_value: getValue('LAND VALUE'),
            building_value: getValue('BUILDING VALUE'),
            just_market_value: getValue('JUST MARKET VALUE'),
            dor_description: getText('Property Use')
        };
    } catch (error) {
        return null;
    }
}

async function run() {
    let deeds = await fetchTaxDeeds();
    
    // Filter for "LIST OF LANDS"
    deeds = deeds.filter(d => {
        const status = (d['Status'] || d['status'] || '').toUpperCase();
        return status.includes('LIST OF LANDS') || status.includes('AVAILABLE');
    });

    console.log(`🔍 Found ${deeds.length} OTC parcels. Enriching top 10...`);

    const finalResults = [];
    for (let i = 0; i < Math.min(deeds.length, 10); i++) {
        const deed = deeds[i];
        const parcelId = deed['Parcel Number'] || deed['parcel_id'];
        console.log(`  [${i+1}/10] Checking ${parcelId}...`);
        
        const pcpao = await fetchPcpao(parcelId);
        if (pcpao) {
            const price = parseFloat((deed['Purchase Price'] || deed['purchase_price'] || '0').replace(/[^0-9.]/g, ''));
            const equity = pcpao.just_market_value > 0 ? (pcpao.just_market_value - price) / pcpao.just_market_value : 0;
            
            finalResults.push({
                case: deed['Case Number'] || deed['case_number'],
                parcel: parcelId,
                address: deed['Property Address'] || deed['address'],
                price: price,
                mkt_value: pcpao.just_market_value,
                bldg_value: pcpao.building_value,
                equity: (equity * 100).toFixed(1) + '%',
                use: pcpao.dor_description
            });
        }
        await new Promise(r => setTimeout(r, 1000)); // Polite rate limit
    }

    finalResults.sort((a, b) => b.mkt_value - a.mkt_value);

    console.log('\n--- 🏠 BEST SCRAPED DEALS (OTC) ---');
    console.table(finalResults);
}

run().catch(console.error);
