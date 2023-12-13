import axios from 'axios';
import { writeResourceId, writeMalformedResource, writeSqlConflictResource } from '../filesystem/index.js';
import types from '../fhir/types.js';

export function processBundle(transactionId, bundle, patientIds) {
  if (bundle.entry && !Array.isArray(bundle.entry)) {
    console.error('No entry object or it is not an array');
    return;
  }
  
  for (const entry of bundle.entry) {
    if (!entry.resource) {
      console.error('No resource object found');
      writeMalformedResource(transactionId, entry);
    }

    const resource = entry.resource;
    const type = resource.resourceType?.toLowerCase();
    const id = resource.id;
    if (!type || !id) {
      console.error('No type or id found');
      writeMalformedResource(transactionId, resource);
      continue;
    }

    if (type === types.Organization || type === types.Medication) continue;

    let patientId
    if (type === types.Patient) patientId = resource.id;
    else if (resource.subject) patientId = resource.subject.reference.split('/')[1];
    else if (resource.patient) patientId = resource.patient.reference.split('/')[1];

    if (patientId && !patientIds.has(patientId)) continue;

    writeResourceId(type.toLowerCase(), id);
  }
}

export async function deleteResource(resource) {
  try {
    await axios.delete(`http://${process.env.HAPI_PROXY_URL}:${process.env.HAPI_PROXY_PORT}/fhir/${resource}`);
    console.log(`${new Date().toISOString()} - DELETED: `, resource);
  } catch (err) {
    if (err.response && err.response.data) {
      const issue = err.response.data.issue[0];
      if (issue.diagnostics.startsWith('HAPI-0550')) {
        writeSqlConflictResource(resource);
        console.error(`FAILED TO DELETE: ${resource}`);
      } else {
        console.error(JSON.stringify(err.response.data));
        throw err;
      }
    } else {
      throw err;
    }
  }
}
