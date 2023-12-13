import { extractPatientIds } from './elastic/index.js';
import { processMongoData, disconnect as mongoDisconnect } from './mongo/index.js';
import { openWriteStreams, readElasticPatientIds } from './filesystem/index.js';

function setupEnv() {
  if (!process.env.FACILITY_ID) process.env.FACILITY_ID = 'placeholder';
  if (!process.env.MONGO_URL) process.env.MONGO_URL = 'mongodb://localhost:27017';
  if (!process.env.ELASTIC_URL) process.env.ELASTIC_URL = 'http://localhost:9201'
  if (!process.env.ELASTIC_PASSWORD) process.env.ELASTIC_PASSWORD = 'dev_password_only';
}

async function main() {
  setupEnv();
  openWriteStreams();

  const healthFacilityId = process.env.FACILITY_ID;
  await extractPatientIds(healthFacilityId);
  
  const patientIds = await readElasticPatientIds();
  await processMongoData(patientIds);
}

main()
  .catch(err => console.error(err))
  .finally(() => {
    mongoDisconnect();
  });
