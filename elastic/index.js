import fs from 'fs';
import { Client } from '@elastic/elasticsearch'

const outputFileStream = fs.createWriteStream('./output/elastic-patients.csv');
outputFileStream.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

const client = new Client({
  node: process.env.ELASTIC_URL,
  auth: {
    username: 'elastic',
    password: process.env.ELASTIC_PASSWORD
  },
});

export async function extractPatientIds(healthFacilityId) {
  if (!healthFacilityId) {
    throw new Error('Failed to pass in healthFacilityId to elastic query');
  }

  let processCounter = 0;
  console.log(`${new Date().toISOString()} - Processing elastic patients`)
  let result = await client.search({
    index: 'fhir-enrich-reports',
    from: 0,
    size: 10000,
    scroll: '120s',
    track_total_hits: true,
    body: {
      query: {
        term: {
          "facility.fhirID": healthFacilityId
        },
      },
    },
  });

  const totalHits = result.body.hits.total.value;

  do {
    if (result.body.hits.hits.length === 0) {
      console.log('reached end of scroll breaking out of loop');
      break;
    }

    let inMemoryStreamHolder = '';
    for (const hit of result.body.hits.hits) {
      if (hit && hit._source && hit._source.patient) {
        inMemoryStreamHolder += `${hit._source.patient.fhirID}\n`;
      } else {
        console.error(`no patientId found for: ${JSON.stringify(hit)}`);
      }
      processCounter++;
    }

    await new Promise((resolve) =>
      outputFileStream.write(inMemoryStreamHolder, resolve)
    );

    console.log(`processed ${processCounter} out of ${totalHits} elastic documents`);

    result = await client.scroll({
      scroll_id: result.body._scroll_id,
      scroll: '120s',
    });

  } while (totalHits !== processCounter);

  console.log(`${new Date().toISOString()} - done elastic extracting`);
}

export function disconnect() {
  client.disconnect();
}