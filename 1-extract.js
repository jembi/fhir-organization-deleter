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
// loop through all patient ids and delete fhir-enrich-report for patient
// delete patient in hapi-fhir
// delete organization

async function main() {
  setupEnv();

  const healthFacilityId = process.env.FACILITY_ID;
  
  const cursor = await getCursor();
  // if we have a cursor we must not extract from elastic (since we already did and are rerunning)
  if (!cursor) await extractPatientIds(healthFacilityId);
  
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

  await flushCursor();
}

main()
  .catch(err => console.error(err))
