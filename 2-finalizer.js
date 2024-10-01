import fs from 'fs';
import readline from 'readline';
import './env/index.js';
import { extractPatientIds, deleteResource, doesPatientHaveResources } from './fhir/index.js';
import { deleteElasticPatient, deleteElasticRawResources, removeLingeringRawResources } from './elastic/index.js';
import { deleteClickhouseRawResources, deleteClickhousePatient } from './clickhouse/index.js';
import { flushCursor, getCursor, writePatientId } from './filesystem/index.js';

async function main() {
  const healthFacilityId = process.env.FACILITY_ID;
  if (!healthFacilityId || healthFacilityId === 'placeholder') {
    throw new Error('Failed to set the FACILITY_ID environment variable, got: ', healthFacilityId);
  }

  console.log(`${new Date().toISOString()} - starting processing`);
  
  const cursor = await getCursor();
  if (cursor) console.log(`${new Date().toISOString()} - Found cursor ${cursor} resuming from there`);
  else await extractPatientIds(healthFacilityId);
  
  let previousCursorFound = cursor === '';
  const patientIdReader = readline.createInterface({
    input: fs.createReadStream(`${process.env.OUTPUT_PATH}/${process.env.PATIENT_ID_FILENAME}`)
  });

  let hasFailedPatients = false;
  for await (const patientId of patientIdReader) {
    if (!previousCursorFound) {
      if (patientId === cursor) previousCursorFound = true;
      else continue;
    }

    await flushCursor(patientId);
    const unsafeToDeletePatient = await doesPatientHaveResources(patientId);
    if (unsafeToDeletePatient) {
      console.log(`${new Date().toISOString()} - patient: ${patientId} still has resources attached. Saving to ${process.env.FAILED_PATIENT_FILENAME}`);
      await writePatientId(patientId, process.env.FAILED_PATIENT_FILENAME);
      hasFailedPatients = true;
      continue;
    }

    console.log(`${new Date().toISOString()} - checking for lingering fhir-raw resources: ${patientId}`);
    await removeLingeringRawResources(patientId);

    try {
      console.log(`${new Date().toISOString()} - deleting patient: ${patientId}`);
      await Promise.all([
        deleteClickhousePatient(patientId),
        deleteElasticPatient(patientId),
        deleteResource(`Patient/${patientId}`)
      ]);
    } catch (err) {
      if (err.response && err.response.data) {
        console.error(JSON.stringify(err.response.data));
      }
      throw err;
    }
  }

  await flushCursor('');
  
  console.log(`${new Date().toISOString()} - deleting organization: `, healthFacilityId);
  if (hasFailedPatients) {
    console.warn('Skipping orgainzation deleting as there is at least 1 failed patient');
  } else {
    await deleteResource(`Organization/${healthFacilityId}`);
    await deleteElasticRawResources([`Organization/${healthFacilityId}`]);
    await deleteClickhouseRawResources([`Organization/${healthFacilityId}`]);
  }

  console.log(`${new Date().toISOString()} - finished processing`);
}

main()
  .catch(err => console.error(err))
