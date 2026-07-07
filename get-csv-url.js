const axios = require('axios');
async function findLinks() {
    try {
        const r = await axios.get('https://www.polktaxes.com/file-download-requests/');
        const matches = r.data.match(/https?:\/\/[^\s"']+?\.csv/gi);
        console.log(matches ? matches.join('\n') : 'No CSV links found');
    } catch (e) {
        console.error(e.message);
    }
}
findLinks();
