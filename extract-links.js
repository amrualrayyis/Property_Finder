const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
    try {
        const r = await axios.get('https://www.polktaxes.com/file-download-requests/');
        const $ = cheerio.load(r.data);
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href) console.log(href);
        });
        $('button').each((i, el) => {
            console.log('BUTTON:', $(el).text(), $(el).attr('onclick') || '');
        });
    } catch (e) {
        console.error(e.message);
    }
}
run();
