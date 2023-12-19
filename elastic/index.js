import { Client } from '@elastic/elasticsearch'

const client = new Client({
  nodes: process.env.ELASTIC_URL || 'http://localhost:9201',
  auth: {
    username: 'elastic',
    password: process.env.ELASTIC_PASSWORD || 'dev_password_only'
  },
});

// Will delete the fhir-enrich-report for the patient as well as the patient from fhir-raw
export async function deleteElasticPatient(patientId) {
  const reportId = `report-${patientId}`;
  const deleteTargets = [
    { delete: { _index: 'fhir-raw-patient', _id: patientId } },
    { delete: { _index: 'fhir-enrich-reports', _id: reportId } }
  ]

  try {
    await client.bulk({ refresh: false, body: deleteTargets });
  } catch (err) {
    console.error('Failed to delete patient\'s enrich report: ', patientId);
    throw err;
  }
}

export async function deleteElasticRawResources(resources) {
  let bulkRequest = [];
  for (const resource of resources) {
    const [type, id] = resource.split('/');
    bulkRequest.push({ delete: { _index: `fhir-raw-${type.toLowerCase()}`, _id: id } });
  }

  try {
    await client.bulk({ refresh: false, body: bulkRequest });
  } catch (err) {
    console.error('Failed to delete patient data from elastic raw');
    throw err;
  }
}