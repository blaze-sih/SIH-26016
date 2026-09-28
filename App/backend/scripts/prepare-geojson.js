'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

function getUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return getUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const geoDir = path.join(__dirname, '../src/public/geojson');
  if (!fs.existsSync(geoDir)) {
    fs.mkdirSync(geoDir, { recursive: true });
  }

  console.log('1. Fetching India States GeoJSON...');
  const indiaStates = await getUrl('https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson');
  console.log('   India states count:', indiaStates.features.length);
  fs.writeFileSync(path.join(geoDir, 'india-states.json'), JSON.stringify(indiaStates));
  console.log('   Saved to src/public/geojson/india-states.json');

  console.log('\n2. Fetching India Districts to extract Maharashtra...');
  const allDistricts = await getUrl('https://raw.githubusercontent.com/udit-001/india-maps-data/master/geojson/india.geojson');
  console.log('   Total districts in source:', allDistricts.features.length);
  console.log('   Sample properties:', allDistricts.features[0].properties);

  const mhFeatures = allDistricts.features.filter(f => {
    const props = f.properties;
    const str = JSON.stringify(props).toLowerCase();
    return str.includes('maharashtra');
  });

  console.log('   Maharashtra districts found:', mhFeatures.length);
  if (mhFeatures.length > 0) {
    console.log('   Sample MH district:', mhFeatures[0].properties);
    const mhGeoJson = {
      type: 'FeatureCollection',
      features: mhFeatures
    };
    fs.writeFileSync(path.join(geoDir, 'maharashtra-districts.json'), JSON.stringify(mhGeoJson));
    console.log('   Saved to src/public/geojson/maharashtra-districts.json');

    // Find Nashik district feature
    const nashikFeature = mhFeatures.find(f => {
      const str = JSON.stringify(f.properties).toLowerCase();
      return str.includes('nashik') || str.includes('nasik');
    });
    if (nashikFeature) {
      console.log('   Found Nashik boundary feature:', nashikFeature.properties);
      const nashikGeoJson = {
        type: 'FeatureCollection',
        features: [nashikFeature]
      };
      fs.writeFileSync(path.join(geoDir, 'nashik-district.json'), JSON.stringify(nashikGeoJson));
      console.log('   Saved to src/public/geojson/nashik-district.json');
    }
  }

  console.log('\n🎉 Finished preparing GeoJSON files!');
}

run().catch(err => {
  console.error('Error preparing geojson:', err);
  process.exit(1);
});
