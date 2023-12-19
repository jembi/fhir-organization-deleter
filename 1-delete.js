import fs from 'fs';
import readline from 'readline';
import './env/index.js';
import { extractPatientIds, deleteResources } from './fhir/index.js';
import { flushCursor, getCursor } from './filesystem/index.js';

async function main() {
  const healthFacilityId = process.env.FACILITY_ID;

  console.log(`${new Date().toISOString()} - starting processing`);
  
  const cursor = await getCursor();
  if (cursor) console.log(`${new Date().toISOString()} - Found cursor ${cursor} resuming from there`);
  else await extractPatientIds(healthFacilityId);
  
  let previousCursorFound = cursor === '';
  const patientIdReader = readline.createInterface({
    input: fs.createReadStream(`${process.env.OUTPUT_PATH}/${process.env.PATIENT_ID_FILENAME}`)
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
