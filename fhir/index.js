import axios from 'axios';
import { writePatientId, writePatientResourcesToFile } from '../filesystem/index.js';
import { deleteElasticRawResources } from '../elastic/index.js';
import types from '../fhir/types.js';

export async function extractPatientIds(healthFacilityId) {
  const innerExtractPatientIds = async (url) => {
    const response = await axios.get(url);
    if (response.data && response.data.entry) {
      for (const entry of response.data.entry) {
        await writePatientId(entry.resource.id);
      }
    }

    const nextLink = response.data.link.filter(link => link.relation === 'next');
    if (nextLink && nextLink.length > 0) {
      await innerExtractPatientIds(nextLink[0].url);
    }
  }

  if (!healthFacilityId || healthFacilityId === 'placeholder') {
    throw new Error('Failed to set the FACILITY_ID environment variable, got: ', healthFacilityId);
  }

  const count = 1000;
  const url = `http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/Patient?organization=${healthFacilityId}&_elements=_id&_count=${count}`;
  await (innerExtractPatientIds(url));
}

export async function deleteResources(patientId) {
  const innerDeleteResources = async (url) => {
    const resources = [];
    const response = await axios.get(url);

    if (!response.data || !response.data.entry) {
      console.log(`Patient - ${patientId} failed to return expected data. Got:\n`, response);
      throw new Error(`Failed to process patient ${patientId}`);
    }

    for (const entry of response.data.entry) {
      const resource = entry.resource;
      const type = resource.resourceType.toLowerCase();
      if (type === types.Patient || type === types.Organization) continue;
      const resourcePath = `${resource.resourceType}/${resource.id}`;
      resources.push(resourcePath);
    }

    if (resources.length > 0) {
      await writePatientResourcesToFile(resources);
      try {
        console.log(`${new Date().toISOString()} - Deleting patient: ${patientId} fhir resources`);
        for (const resource of resources) {
          await deleteResource(resource);
        }
      } catch (err) {
        console.log('Failed to delete hapi-fhir data for patient: ', patientId);
        throw err;
      }
  
      try {
        console.log(`${new Date().toISOString()} - Deleting patient: ${patientId} elastic raw resources`);
        await deleteElasticRawResources(resources);
      } catch (err) {
        console.log('Failed to delete elastic data for patient: ', patientId);
        throw err;
      }
    }

    const nextLink = response.data.link.filter(link => link.relation === 'next');
    if (nextLink && nextLink.length > 0) {
      await innerDeleteResources(nextLink[0].url);
    }
  }

  const count = 1000;
  const url = `http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/Patient/${patientId}/$everything?_elements=_id&_count=${count}`;
  await innerDeleteResources(url);
}

async function deleteResource(resource) {
  try {
    await new Promise((resolve) => setTimeout(() => { resolve() }, 10));
    await axios.delete(`http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/${resource}`);
  } catch (err) {
    if (err.response && err.response.data) {
      console.error(JSON.stringify(err.response.data));
      throw err;
    } else {
      throw err;
    }
  }
}
