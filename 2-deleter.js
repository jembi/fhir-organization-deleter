import { deleteResource } from './fhir/index.js';
import { processFile } from './filesystem/index.js';

function setupEnv() {
  if (!process.env.HAPI_PROXY_URL) process.env.HAPI_PROXY_URL = 'localhost';
  if (!process.env.HAPI_PROXY_PORT) process.env.HAPI_PROXY_PORT = '3447'
}

async function main() {
  setupEnv();

  await processFile('10-questionnaireResponse.csv', (line) => deleteResource(line));
  await processFile('9-medicationStatement.csv', (line) => deleteResource(line));
  await processFile('8-procedure.csv', (line) => deleteResource(line));
  await processFile('7-diagnosticReport.csv', (line) => deleteResource(line));
  await processFile('6-serviceRequest.csv', (line) => deleteResource(line));
  await processFile('5-observation.csv', (line) => deleteResource(line));
  await processFile('4-careplan.csv', (line) => deleteResource(line));
  await processFile('3-medicationDispense.csv', (line) => deleteResource(line));
  await processFile('2-relatedPerson.csv', (line) => deleteResource(line));
  await processFile('1-encounter.csv', (line) => deleteResource(line));
  await processFile('0-patient.csv', (line) => deleteResource(line));
}

main().catch(err => console.error(err));