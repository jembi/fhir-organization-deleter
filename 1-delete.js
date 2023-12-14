import fs from 'fs';
import readline from 'readline';
import { extractPatientIds, deleteResources } from './fhir/index.js';
import { flushCursor, getCursor } from './filesystem/index.js';

function setupEnv() {
  if (!process.env.FACILITY_ID) process.env.FACILITY_ID = '009a6a861c1b45778c0cbedadefe52a4';
  if (!process.env.ELASTIC_URL) process.env.ELASTIC_URL = 'http://localhost:9201'
  if (!process.env.ELASTIC_PASSWORD) process.env.ELASTIC_PASSWORD = 'dev_password_only';
  if (!process.env.HAPI_FHIR_URL) process.env.HAPI_FHIR_URL = 'localhost';
  if (!process.env.HAPI_FHIR_PORT) process.env.HAPI_FHIR_PORT = 3447;

}

// @TODO
// once processed all patients
// loop through all patient ids and delete fhir-enrich-report for patient /// report-${patientId}
// delete patient in hapi-fhir /// DELETE /fhir/Patient/patientId
// delete organization  /// DELETE /fhir/Organization/id

async function main() {
  setupEnv();
  const healthFacilityId = process.env.FACILITY_ID;

  console.log(`${new Date().toISOString()} - starting processing`);
  
  const cursor = await getCursor();
  if (cursor) console.log(`${new Date().toISOString()} - Found cursor ${cursor} resuming from there`);
  else await extractPatientIds(healthFacilityId);
  
  let previousCursorFound = cursor === '';
  const patientIdReader = readline.createInterface({
    input: fs.createReadStream(`./output/patient-ids.csv`)
  });

  for await (const patientId of patientIdReader) {
    if (!previousCursorFound) {
      if (patientId === cursor) previousCursorFound = true;
      else continue;
    }

    await flushCursor(patientId);

    await deleteResources(patientId);
  }

  await flushCursor('');

  console.log(`${new Date().toISOString()} - finished processing`);
}

main()
  .catch(err => console.error(err))
