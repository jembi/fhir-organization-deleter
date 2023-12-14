import { Client } from '@elastic/elasticsearch'

const client = new Client({
  nodes: process.env.ELASTIC_URL,
  auth: {
    username: 'elastic',
    password: process.env.ELASTIC_PASSWORD
  },
});

export async function deleteElasticRawResources(resources) {
  let bulkRequest = [];
  for (const resource of resources) {
    const [type, id] = resource.split('/');
    bulkRequest.push({ delete: { _index: `fhir-raw-${type.toLowerCase()}`, _id: id } });
  }

  try {
    await client.bulk({ refresh: true, body: bulkRequest });
  } catch (err) {
    console.error('Failed to delete patient data from elastic raw');
    throw err;
  }
}