import { extractPatientIds, disconnect as elasticDisconnect } from './elastic/index.js';
import { processMongoData, disconnect as mongoDisconnect } from './mongo/index.js';
import { openWriteStreams, readElasticPatientIds } from './filesystem/index.js';

async function main() {
  openWriteStreams();

  const healthFacilityId = '009a6a861c1b45778c0cbedadefe52a4';
  await extractPatientIds(healthFacilityId);
  
  const patientIds = await readElasticPatientIds();
  await processMongoData(patientIds);
}

main()
  .catch(err => console.error(err))
  .finally(() => {
    mongoDisconnect();
    elasticDisconnect();
  });
