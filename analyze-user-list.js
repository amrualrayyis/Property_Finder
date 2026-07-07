const axios = require('axios');
const cheerio = require('cheerio');

const PCPAO_PARCEL = "https://pcpao.gov/parceldetail.aspx";

const USER_PARCELS = [
    { id: "30-31-20-0000-0002-3190", case: "00310-2025" },
    { id: "30-31-28-0000-0003-3260", case: "00311-2025" },
    { id: "23-29-33-1423-8300-0750", case: "00312-2025" },
    { id: "26-28-29-6320-0000-5111", case: "00313-2025" },
    { id: "27-27-28-7700-0000-1082", case: "00314-2025" },
    { id: "27-30-02-9005-0000-1030", case: "00315-2025" },
    { id: "23-28-12-0380-0000-4180", case: "00316-2025" },
    { id: "23-28-12-0380-0000-4190", case: "00317-2025" },
    { id: "23-28-12-0535-0000-1042", case: "00320-2025" },
    { id: "23-28-22-0940-0000-1291", case: "00321-2025" },
    { id: "24-28-18-2030-0002-3011", case: "00322-2025" },
    { id: "27-27-21-7560-0000-2260", case: "00323-2025" },
    { id: "27-29-34-8730-0000-1050", case: "00354-2025" },
    { id: "22-26-02-0000-0004-1030", case: "00571-2025" },
    { id: "26-25-13-9999-8102-3020", case: "00589-2025" },
    { id: "29-31-30-9933-2600-1712", case: "00879-2025" },
    { id: "25-25-29-0000-0004-2140", case: "00975-2025" },
    { id: "24-25-25-0000-0003-3150", case: "01012-2025" },
    { id: "23-29-14-0000-0001-1880", case: "01045-2025" },
    { id: "27-30-11-9175-1000-5120", case: "01094-2025" }
];

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
            land: getValue('LAND VALUE'),
            bldg: getValue('BUILDING VALUE'),
            just: getValue('JUST MARKET VALUE'),
            use: getText('Property Use')
        };
    } catch (error) {
        return null;
    }
}

async function run() {
    console.log(`🔍 Analyzing ${USER_PARCELS.length} parcels from your list...`);
    const results = [];

    for (let i = 0; i < USER_PARCELS.length; i++) {
        const p = USER_PARCELS[i];
        process.stdout.write(`  [${i+1}/${USER_PARCELS.length}] Checking ${p.id}... `);
        
        const data = await fetchPcpao(p.id);
        if (data) {
            console.log(`Value: $${data.just}`);
            results.push({
                Case: p.case,
                Parcel: p.id,
                Mkt_Value: data.just,
                Bldg_Value: data.bldg,
                Use: data.use
            });
        } else {
            console.log(`Failed`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    results.sort((a, b) => b.Mkt_Value - a.Mkt_Value);
    
    console.log('\n--- 📊 SCRAPED RESULTS SORTED BY VALUE ---');
    console.table(results);
}

run();
