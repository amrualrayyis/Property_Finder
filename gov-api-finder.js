const axios = require('axios');

/**
 * Property Finder - Government API Edition
 * This script is pre-loaded with official government API endpoints for major US cities.
 */

const GOV_ENDPOINTS = {
  philadelphia: {
    name: "Philadelphia, PA",
    description: "Real Estate Tax Balances (includes delinquencies)",
    url: "https://data.phila.gov/resource/8atv-m9p6.json",
    query: (min) => `?$where=total_balance > ${min}&$limit=10`,
    fields: { id: 'parcel_number', balance: 'total_balance', info: 'property_address' }
  },
  nyc: {
    name: "New York City, NY",
    description: "DOF Property Charges Balance",
    url: "https://data.cityofnewyork.us/resource/scjx-j6np.json",
    query: (min) => `?$where=sum_bal > ${min}&$limit=10`,
    fields: { id: 'parid', balance: 'sum_bal', info: 'account_id' }
  },
  chicago: {
    name: "Cook County, IL (Chicago)",
    description: "Annual Tax Sale Dataset",
    url: "https://datacatalog.cookcountyil.gov/resource/5pge-nu6u.json",
    query: () => `?$limit=10`,
    fields: { id: 'pin', balance: 'tax_year', info: 'status' }
  },
  sf: {
    name: "San Francisco, CA",
    description: "Assessor-Recorder Secured Tax Rolls",
    url: "https://data.sfgov.org/resource/wv9v-9icx.json",
    query: () => `?$limit=10`,
    fields: { id: 'rpcl_id', balance: 'tot_tax_val', info: 'prop_addr' }
  }
};

async function run(region, minBalance) {
  const endpoint = GOV_ENDPOINTS[region.toLowerCase()];
  
  if (!endpoint) {
    console.log("❌ Region not found. Available pre-loaded gov APIs:");
    Object.keys(GOV_ENDPOINTS).forEach(k => {
      console.log(` - ${k}: ${GOV_ENDPOINTS[k].name}`);
    });
    return;
  }

  console.log(`\n--- 🏛️ Official Gov Data: ${endpoint.name} ---`);
  console.log(`Description: ${endpoint.description}`);

  try {
    const fullUrl = endpoint.url + endpoint.query(minBalance);
    const response = await axios.get(fullUrl);
    const results = response.data;

    if (results && results.length > 0) {
      results.forEach((item, idx) => {
        const f = endpoint.fields;
        console.log(`\n[${idx + 1}] ID: ${item[f.id] || 'N/A'}`);
        console.log(`    Value/Balance: $${item[f.balance] || 'N/A'}`);
        console.log(`    Location/Info: ${item[f.info] || 'N/A'}`);
        
        if (region.toLowerCase() === 'philadelphia') {
          console.log(`    Details: https://property.phila.gov/?p=${item[f.id]}`);
        }
      });
    } else {
      console.log('No properties found for this specific query.');
    }
  } catch (error) {
    console.error(`Error: Could not reach the ${region} API. It may be temporarily down or the schema changed.`);
  }
}

const region = process.argv[2];
const min = process.argv[3] || 1000;

if (!region) {
  console.log("Usage: node gov-api-finder.js [region] [minBalance]");
  run('list'); 
} else {
  run(region, min);
}
