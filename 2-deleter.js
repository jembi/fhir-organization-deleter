import { deleteResource } from './fhir/index.js';
import { processFile } from './filesystem/index.js';

function setupEnv() {
  if (!process.env.HAPI_PROXY_URL) process.env.HAPI_PROXY_URL = 'localhost';
  if (!process.env.HAPI_PROXY_PORT) process.env.HAPI_PROXY_PORT = '3447'
}

async function main() {
  setupEnv();

  await processFile('patient-ids.csv', (line) => deleteElasticEnrichReport(patientId));
  // delete fhir-patient
  // delete fhir-org
}

main().catch(err => console.error(err));