import fs from 'fs';
import readline from 'readline';
import './env/index.js';
import { extractPatientIds, deleteResources } from './fhir/index.js';
import { flushCursor } from './filesystem/index.js';

const PATH_PREFIX = process.env.OUTPUT_PATH || './output';

async function main() {
  const healthFacilityId = process.env.FACILITY_ID;

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
    totalPatientsProcessed += 2000;
    console.log(`${new Date().toISOString()} - Processed 2000 patients, total processed: ${totalPatientsProcessed}`);
    if(!nextUrl) break;
  }

  await flushCursor('');

  console.log(`${new Date().toISOString()} - finished processing`);
}

main()
  .catch(err => console.error(err))
