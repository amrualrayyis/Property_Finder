const axios = require('axios');
const fs = require('fs');
const { getDynamicModel } = require('../Job-Dorker/ai-model.js');
require('dotenv').config(); 
require('dotenv').config({ path: '../Job-Dorker/.env' });

/**
 * 🏠 $200K CASH-FLOW "YIELD" FINDER
 * -----------------------------------------------
 * Targets: Cleveland, Indianapolis, Memphis, Kansas City, St. Louis.
 * Logic: 1% Rule, CapEx Shield (New Roof/HVAC), 45+ Days on Market.
 */

const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;

// High-yield Cash Flow MSAs (Midwest & South)
const CASH_FLOW_MARKETS = [
    { city: "Cleveland", state: "OH", avgRent: 1400 },
    { city: "Indianapolis", state: "IN", avgRent: 1500 },
    { city: "Memphis", state: "TN", avgRent: 1350 },
    { city: "Kansas City", state: "MO", avgRent: 1450 },
    { city: "St. Louis", state: "MO", avgRent: 1300 },
    { city: "Louisville", state: "KY", avgRent: 1400 }
];

async function runCashFlowDeepSearch() {
    console.log(`\n--- 🚀 Starting $200k Cash-Flow Yield Search ---`);

    if (!RENTCAST_API_KEY) {
        console.error("❌ RENTCAST_API_KEY missing.");
        return;
    }

    let allLeads = [];

    for (const loc of CASH_FLOW_MARKETS) {
        try {
            console.log(`📡 Scanning ${loc.city}, ${loc.state} (Targeting 1% Yield)...`);
            
            // Loosening filters slightly to ensure we get data to evaluate
            const commonParams = `&state=${loc.state}&status=Active&propertyType=Single%20Family,Multi-Family&price=100000:250000&limit=40`;
            
            const [hotRes, staleRes] = await Promise.all([
                axios.get(`https://api.rentcast.io/v1/listings/sale?city=${encodeURIComponent(loc.city)}${commonParams}&daysOld=0:14`, {
                    headers: { 'X-Api-Key': RENTCAST_API_KEY, 'accept': 'application/json' }
                }),
                axios.get(`https://api.rentcast.io/v1/listings/sale?city=${encodeURIComponent(loc.city)}${commonParams}&daysOld=30:`, {
                    headers: { 'X-Api-Key': RENTCAST_API_KEY, 'accept': 'application/json' }
                })
            ]);

            allLeads.push(
                ...(hotRes.data || []).map(l => ({ ...l, strategy: 'HOT', marketRent: loc.avgRent })),
                ...(staleRes.data || []).map(l => ({ ...l, strategy: 'STALE', marketRent: loc.avgRent }))
            );
        } catch (e) {
            console.error(`Error scanning ${loc.city}:`, e.message);
        }
    }

    if (allLeads.length === 0) {
        console.log("No listings found at all. Please check your API key and city names.");
        return;
    }

    // Filter: CapEx Shield & Junk Removal
    const junkKeywords = ["land", "lot", "acreage", "zoning", "vacant lot", "mobile home", "trailer", "auction"];
    const capExKeywords = ["new roof", "new hvac", "updated plumbing", "updated electrical", "remodeled", "turnkey", "new furnace", "fresh paint", "new flooring"];
    
    const filteredLeads = allLeads.filter(l => {
        const desc = (l.description || "").toLowerCase();
        const type = (l.propertyType || "").toLowerCase();
        const isJunk = junkKeywords.some(jk => desc.includes(jk) || type.includes(jk));
        
        // We want to pass more leads to AI for nuanced evaluation
        return !isJunk;
    });

    console.log(`\n🔍 Found ${filteredLeads.length} leads. AI is extracting Elite Cash-Flow Deals...`);

    const model = await getDynamicModel('pro');

    const evaluationPrompt = `
        You are an Expert Cash-Flow Investor. 
        Evaluate these properties for a $200k cash purchase in the Midwest/South.
        
        GOAL: Generate 8-12% Net Cash-on-Cash Return.
        
        CRITICAL EVALUATION CRITERIA:
        1. THE 1% RULE: Monthly Rent should be ~1% of Purchase Price. (Assume local market rent if not provided).
        2. CAPEX SHIELD: Prioritize "New Roof", "New HVAC", "Updated Systems".
        3. NEIGHBORHOOD: Class B/C (working class, stable).
        4. NEGOTIATION: If daysOld > 30, recommend an offer 10-15% below list.

        Return ONLY a JSON array of objects: {city, address, price, score, yield_est, reasoning, action}.
        Only include the top 10 properties with a Score of 8.0 or higher.

        DATA:
        ${JSON.stringify(filteredLeads.slice(0, 50).map(l => ({
            city: l.city,
            address: l.addressLine1,
            price: l.price,
            daysOld: l.daysOld,
            marketRent: l.marketRent,
            desc: l.description
        })), null, 2)}
    `;

    try {
        const result = await model.generateContent(evaluationPrompt);
        let responseText = result.response.text().trim();

        if (responseText.includes("```json")) responseText = responseText.split("```json")[1].split("```")[0].trim();
        else if (responseText.includes("```")) responseText = responseText.split("```")[1].split("```")[0].trim();

        const eliteDeals = JSON.parse(responseText);

        if (eliteDeals.length === 0) {
            console.log("No elite cash-flow deals (8.0+) found in this batch.");
            return;
        }

        const fileName = `Cash-Flow-Yield-Deals-${new Date().toISOString().split('T')[0]}.csv`;
        const csvHeader = "Score,City,Address,Price,Est_Monthly_Rent,Reasoning,Action\n";
        const csvRows = eliteDeals.map(e => 
            `${e.score},${e.city},"${e.address}","$${e.price.toLocaleString()}","${e.yield_est}","${e.reasoning.replace(/"/g, '""')}","${e.action.replace(/"/g, '""')}"`
        ).join('\n');

        fs.writeFileSync(fileName, csvHeader + csvRows);

        console.log(`\n✅ CASH-FLOW REPORT GENERATED: ${fileName}`);
        eliteDeals.sort((a, b) => b.score - a.score).slice(0, 5).forEach(e => {
            console.log(`\n[${e.score}/10] ${e.city} - ${e.address}`);
            console.log(`    Price: $${e.price.toLocaleString()} | Rent Goal: ${e.yield_est}`);
            console.log(`    Reasoning: ${e.reasoning}`);
            console.log(`    Action: ${e.action}`);
        });

    } catch (error) {
        console.error("AI Evaluation Error:", error.message);
    }
}

runCashFlowDeepSearch();
