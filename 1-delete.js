import fs from 'fs';
import readline from 'readline';
import './env/index.js';
import { extractPatientIds, deleteResources } from './fhir/index.js';
import { deleteClickhouseAllPatients } from './clickhouse/index.js';
import { flushCursor } from './filesystem/index.js';

const PATH_PREFIX = process.env.OUTPUT_PATH || './output';

async function main() {
  const healthFacilityId = process.env.FACILITY_ID;

  const start = new Date().getTime();
  console.log(`${new Date().toISOString()} - starting processing`);
  
  let totalPatientsProcessed = 0;
  let nextUrl = null;

  while (true) {
    nextUrl = await extractPatientIds(healthFacilityId, nextUrl);

    // Step 2: Read patient IDs from the file and process them in batches of 2000
    const patientIdReader = readline.createInterface({
      input: fs.createReadStream(`${PATH_PREFIX}/${process.env.PATIENT_ID_FILENAME}`)
    });

    for await (const patientId of patientIdReader) {
      await deleteResources(patientId);
    }  

    // Handle deletion from ClickHouse
    try {
      console.log(`${new Date().toISOString()} - Deleting all patients ClickHouse raw resources`);
      await deleteClickhouseAllPatients(patientIdReader);
    } catch (err) {
      console.error(`Failed to delete ClickHouse data for patient ${patientId}:`, err);
      throw err;
    }

    totalPatientsProcessed += 2000;
    console.log(`${new Date().toISOString()} - Processed 2000 patients, total processed: ${totalPatientsProcessed}`);
    if(!nextUrl) break;
  }

  await flushCursor('');

  console.log(`${new Date().toISOString()} - finished processing`);
  const end = new Date().getTime();
  const duration = (end - start) / 1000;
  console.log(`${new Date().toISOString()} - finished processing in ${duration} seconds`);
}

main()
  .catch(err => console.error(err))
