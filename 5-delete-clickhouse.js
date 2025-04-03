import { createReadStream } from 'fs';
import readline from 'readline';
import './env/index.js';
import { bulkDeleteResourcesForIds } from './clickhouse/index.js';
import { doesFileExist, flushCursor, bulkWriteResourceIds, closeWriteStreams } from './filesystem/index.js';

const PATH_PREFIX = process.env.OUTPUT_PATH || './output';
const RESOURCE_ID_FILENAME = process.env.RESOURCE_ID_FILENAME || 'ids.csv';
const BATCH_SIZE = process.env.BATCH_SIZE || 1000;

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

    const resourceIdsReader = readline.createInterface({
      input: createReadStream(filePath)
    });

    const resourceIds = [];
    for await (const id of resourceIdsReader) {
      resourceIds.push(id);
    }

    // Process in batches
    for (let i = 0; i < resourceIds.length; i += BATCH_SIZE) {
      const batch = resourceIds.slice(i, i + BATCH_SIZE);
      
      const success = await bulkDeleteResourcesForIds(tableNames[resourceType], batch);
      if (success) {
        console.log(`Deleted ${batch.length} ${resourceTypes[resourceType]} resources from clickhouse`);
        // Bulk write deleted IDs to file
        await bulkWriteResourceIds(
          batch, 
          `deleted-${tableNames[resourceType]}-${new Date().toISOString()}-${RESOURCE_ID_FILENAME}`
        );
        console.log(`Wrote ${batch.length} deleted ${resourceTypes[resourceType]} resources to file`);
      }
    }
  }

  // Don't forget to close streams at the end
  await closeWriteStreams();

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
