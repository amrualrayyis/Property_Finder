const axios = require('axios');
const names = ['taxdeedapps.csv', 'taxdeed.csv', 'taxdeeds.csv', 'TDA.csv', 'taxdeed_applications.csv'];
const paths = ['/downloads/', '/content/files/', '/files/'];
async function brute() {
    for (const p of paths) {
        for (const n of names) {
            const url = `https://www.polktaxes.com${p}${n}`;
            try {
                const res = await axios.head(url);
                if (res.status === 200) {
                    console.log('FOUND:', url);
                    return;
                }
            } catch (e) {}
        }
    }
    console.log('None found');
}
brute();
