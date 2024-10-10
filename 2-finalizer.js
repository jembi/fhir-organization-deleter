import fs from 'fs';
import readline from 'readline';
import './env/index.js';
import { deleteResource, doesPatientHaveResources } from './fhir/index.js';
import { deleteElasticPatient, deleteElasticRawResources, removeLingeringRawResources } from './elastic/index.js';
import { deleteClickhouseRawResources, deleteClickhouseAllPatients } from './clickhouse/index.js';
import { flushCursor, getCursor, writePatientId } from './filesystem/index.js';

async function main() {
  const healthFacilityIds = process.env.FACILITY_ID_LIST ? process.env.FACILITY_ID_LIST.split(',') : [];
  if (healthFacilityIds.length === 0) {
    throw new Error('Failed to set the FACILITY_ID_LIST environment variable, got: ', process.env.FACILITY_ID_LIST);
  }

  for (const healthFacilityId of healthFacilityIds) {

    const start = new Date().getTime();
    console.log(`${new Date().toISOString()} - starting processing for facility: ${healthFacilityId}`);
    
    const cursor = await getCursor();

    let previousCursorFound = cursor === '';
    const patientIdReader = readline.createInterface({
      input: fs.createReadStream(`${process.env.OUTPUT_PATH}/${process.env.PATIENT_ID_FILENAME}-${healthFacilityId}`)
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
        console.log(`${new Date().toISOString()} - patient: ${patientId} still has resources attached. Saving to ${process.env.FAILED_PATIENT_FILENAME}-${healthFacilityId}`);
        await writePatientId(patientId, `${process.env.FAILED_PATIENT_FILENAME}-${healthFacilityId}`);
        hasFailedPatients = true;
        continue;
      }

      console.log(`${new Date().toISOString()} - checking for lingering fhir-raw resources: ${patientId}`);
      await removeLingeringRawResources(patientId);

      try {
        console.log(`${new Date().toISOString()} - deleting patient: ${patientId}`);
        await Promise.all([
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
    
    // Handle deletion from ClickHouse
    try {
      console.log(`${new Date().toISOString()} - Deleting all patients ClickHouse raw resources`);
      await deleteClickhouseAllPatients(patientIdReader);
    } catch (err) {
      if (err.response && err.response.data) {
        console.error(JSON.stringify(err.response.data));
      }
      throw err;
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

    console.log(`${new Date().toISOString()} - finished processing for facility: ${healthFacilityId}`);
    const end = new Date().getTime();
    const duration = (end - start) / 1000;
    console.log(`${new Date().toISOString()} - finished processing facility ${healthFacilityId} in ${duration} seconds`);
    }
  }

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
