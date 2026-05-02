const fs = require('fs');
let code = fs.readFileSync('services/metaAds.js', 'utf8');

code = code.replace(/await graphGet\(`\$\{adAccountId\}\/insights`, params\)/g, 'await graphGet(workspaceId, `${adAccountId}/insights`, params)');
code = code.replace(/await graphGet\(`\$\{adAccountId\}\/campaigns`,/g, 'await graphGet(workspaceId, `${adAccountId}/campaigns`,');

code = code.replace(/async function fetchCampaigns\(\)/g, 'async function fetchCampaigns(workspaceId)');
code = code.replace(/getCredentials\(\)/g, 'getCredentials(workspaceId)');
code = code.replace(/isConfigured\(\)/g, 'isConfigured(workspaceId)');

code = code.replace(/async function fetchDemographics\(fromDate, toDate\)/g, 'async function fetchDemographics(workspaceId, fromDate, toDate)');
code = code.replace(/async function fetchAds\(fromDate, toDate\)/g, 'async function fetchAds(workspaceId, fromDate, toDate)');

fs.writeFileSync('services/metaAds.js', code);
console.log('Fixed metaAds.js');
