import fs from 'fs';
import readline from 'readline';
import './env/index.js';
import { doesResourceExist } from './fhir/index.js';
import { updateResourceDeletedAt} from './clickhouse/index.js';
import { readResourceIdsFromCsv, doesFileExist, flushCursor } from './filesystem/index.js';

const PATH_PREFIX = process.env.OUTPUT_PATH || './output';
const DELETED_AT = process.env.DELETED_AT || '2025-01-01';
const RESOURCE_ID_FILENAME = process.env.RESOURCE_ID_FILENAME || 'ids.csv';

const tableNames = ['care_plan', 'diagnostic_report', 'encounter', 'medication_dispense', 'medication_statement',
  'observation', 'procedure', 'questionnaire_response', 'service_request'];

const resourceTypes = ['CarePlan', 'DiagnosticReport', 'Encounter', 'MedicationDispense', 'MedicationStatement',
  'Observation', 'Procedure', 'QuestionnaireResponse', 'ServiceRequest'];

async function main() {
  const start = new Date().getTime();
  console.log(`${new Date().toISOString()} - starting processing`);
  
  for(const resourceType in resourceTypes) {
    const filePath = `${PATH_PREFIX}/${tableNames[resourceType]}-${RESOURCE_ID_FILENAME}`;
    
    const fileExists = await doesFileExist(filePath);
    if(!fileExists) {
      console.warn(`File ${filePath} does not exist, skipping...`);
      continue;
    }

    const resourceIds = await readResourceIdsFromCsv(filePath);
    console.log(`Processing ${resourceIds.length} resources for type ${resourceTypes[resourceType]}`);

    for(const id of resourceIds) {
      const resourceExists = await doesResourceExist(resourceTypes[resourceType], id);
      if(!resourceExists) {
        await updateResourceDeletedAt(tableNames[resourceType], id, DELETED_AT);
      }
    }
  }

  await flushCursor('');

  console.log(`${new Date().toISOString()} - finished processing`);
  const end = new Date().getTime();
  const duration = (end - start) / 1000;
  console.log(`${new Date().toISOString()} - finished processing in ${duration} seconds`);
}

main()
  .catch(err => {
    console.error('Error in main process:', err);
    process.exit(1);
  });
