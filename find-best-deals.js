const axios = require('axios');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * find-best-deals.js
 * Programmatically finds property deals and exports to CSV (Excel).
 */

const GEMINI_API_KEY = "AIzaSyDduZXKDfu4qkAFd68vNgjYDlTNy5wFCCA"; // From your .env

async function getBestDeals() {
  console.log('--- 🚀 Programmatically Finding "Best Deals" ---');
  
  const deals = [];

  // 1. Fetch from NYC API
  try {
    console.log('Fetching NYC Data...');
    const nycUrl = "https://data.cityofnewyork.us/resource/scjx-j6np.json?$limit=20&$where=sum_bal > 100000";
    const res = await axios.get(nycUrl);
    res.data.forEach(item => {
      deals.push({
        source: 'NYC',
        id: item.parid,
        balance: parseFloat(item.sum_bal),
        info: `Account: ${item.account_id}`
      });
    });
  } catch (e) {
    console.log('NYC API currently busy.');
  }

  // 2. Fetch from Philadelphia API (if available)
  try {
    console.log('Fetching Philly Data...');
    const phillyUrl = "https://data.phila.gov/resource/8atv-m9p6.json?$limit=20&$where=total_balance > 20000";
    const res = await axios.get(phillyUrl);
    res.data.forEach(item => {
      deals.push({
        source: 'Philly',
        id: item.parcel_number,
        balance: parseFloat(item.total_balance),
        info: item.property_address
      });
    });
  } catch (e) {
    console.log('Philly API currently busy.');
  }

  if (deals.length === 0) {
    console.log('❌ No data retrieved from APIs. Please try again in a few minutes.');
    return;
  }

  console.log(`Found ${deals.length} candidate properties. Using AI to pick the "Best Deal"...`);

  // 3. Use AI to pick the best 5
  let topDeals = deals;
  if (GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `You are a real estate investment expert. Here is a list of properties with delinquent tax/charge balances.
    Pick the top 5 "Best Deals" based on the highest potential for a high-value property (higher balances often mean larger/more valuable real estate).
    
    List:
    ${deals.map((d, i) => `${i}. Source: ${d.source}, ID: ${d.id}, Balance: $${d.balance}, Info: ${d.info}`).join('\n')}
    
    Respond with ONLY the indices of the top 5 deals separated by commas. Example: 0,3,7,12,15`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const indices = text.split(',').map(i => parseInt(i.trim()));
      topDeals = indices.map(i => deals[i]).filter(d => d !== undefined);
    } catch (err) {
      console.log('AI processing failed, using raw data.');
    }
  }

  // 4. Export to CSV (Excel)
  const csvHeader = "Source,Property_ID,Delinquent_Balance,Location_Info\n";
  const csvRows = topDeals.map(d => `${d.source},${d.id},${d.balance},"${d.info}"`).join('\n');
  const csvContent = csvHeader + csvRows;

  const fileName = 'Best-Property-Deals.csv';
  fs.writeFileSync(fileName, csvContent);

  console.log(`\n✅ SUCCESS!`);
  console.log(`The top ${topDeals.length} deals have been exported to: ${fileName}`);
  console.log(`You can now open this file in Excel.`);
  
  console.log('\nPreview of Top 3 Deals:');
  topDeals.slice(0, 3).forEach((d, i) => {
    console.log(`${i+1}. ${d.source} - ${d.id}: $${d.balance} (${d.info})`);
  });
}

getBestDeals();
