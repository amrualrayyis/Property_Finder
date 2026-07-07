require('dotenv').config();
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY;

async function findTaxDelinquentLists(state = 'Florida') {
  console.log(`--- 🏠 Searching for Tax Delinquent & OTC Property Lists in ${state} ---`);

  if (!SERPAPI_KEY) {
    console.error('Error: SERPAPI_KEY is missing in .env');
    return;
  }

  const queries = [
    `site:.gov "${state}" "lands available for taxes"`,
    `site:.gov "${state}" "tax deed" "struck off"`,
    `site:.gov "${state}" "surplus" "tax sale" list`,
    `site:.gov "${state}" "over the counter" property list`
  ];

  for (const q of queries) {
    try {
      console.log(`Searching: ${q}...`);
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: q,
          api_key: SERPAPI_KEY,
          engine: 'google'
        }
      });

      const results = response.data.organic_results;
      if (results && results.length > 0) {
        results.slice(0, 3).forEach(result => {
          console.log(`\nFound: ${result.title}`);
          console.log(`Link: ${result.link}`);
          console.log(`Snippet: ${result.snippet}`);
        });
      }
    } catch (error) {
      console.error(`Search error for query "${q}":`, error.message);
    }
  }
}

const targetState = process.argv[2] || 'Florida';
findTaxDelinquentLists(targetState);
