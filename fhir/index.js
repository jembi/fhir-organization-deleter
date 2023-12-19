import axios from 'axios';
import { writePatientId, writePatientResourcesToFile } from '../filesystem/index.js';
import { deleteElasticRawResources } from '../elastic/index.js';
import types from '../fhir/types.js';

const axiosInstance = axios.create({ timeout: Number(process.env.AXIOS_TIMEOUT) || 60000 })

export async function extractPatientIds(healthFacilityId) {
  const innerExtractPatientIds = async (url) => {
    const response = await axiosInstance.get(url);
    if (response.data && response.data.entry) {
      for (const entry of response.data.entry) {
        await writePatientId(entry.resource.id, process.env.PATIENT_ID_FILENAME);
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
    const response = await axiosInstance.get(url);

    if (!response.data) {
      console.log(`Patient - ${patientId} failed to return expected data. Got:\n`, response);
      throw new Error(`Failed to process patient ${patientId}`);
    }

    if (!response.data.entry) {
      console.log(`Patient - ${patientId} no more data entries\n`);
      return;
    }

    for (const entry of response.data.entry) {
      const resource = entry.resource;
      const type = resource.resourceType.toLowerCase();
      if (type === types.Patient || type === types.Organization) continue;
      const resourcePath = `${resource.resourceType}/${resource.id}`;
      resources.push(resourcePath);
    }

    console.log('Resources #', resources.length);
    if (resources.length > 0) {
      console.log(`${new Date().toISOString()} - Writing patient: ${patientId} resources file`);
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

export async function deleteResource(resource, retries = 0) {
  try {
    await new Promise((resolve) => setTimeout(() => { resolve() }, 10));
    await axiosInstance.delete(`http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/${resource}`);
  } catch (err) {
    if (err.code && err.code === 'ECONNABORTED') {
      if (retries < Number(process.env.MAX_RETIRES || 10)) {
        console.warn(`Hapi-fhir timeout hit for DELETE ${resource} trying again`);
        return deleteResource(resource, ++retries);
      }
    }

    if (err.response && err.response.data) {
      console.error(JSON.stringify(err.response.data));
    }
    
    throw err;
  }
}

export async function doesPatientHaveResources(patientId) {
  try {
    const response = await axiosInstance.get(`http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/Patient/${patientId}/$everything`);
    if (!response.data) {
      console.log(`Patient - ${patientId} failed to return expected data. Got:\n`, response);
      return true;
    }

    if (!response.data.entry) return false;

    // returns themself and the organization they are attached to
    // so more than 2 indicates a resource is still attached to them
    return response.data.entry.length > 2;
  } catch (err) {
    if (err.response && err.response.data) {
      console.error(JSON.stringify(err.response.data));
    } else {
      console.error(err);
    }

    return true;
  }
}

async function expungeResource(resource) {
  try {
    await new Promise((resolve) => setTimeout(() => { resolve() }, 10));
    await axiosInstance.post(`http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/${resource}/$expunge`, {
      "resourceType": "Parameters",
      "parameter": [
        {
          "name": "limit",
          "valueInteger": 1000
        },{
          "name": "expungeDeletedResources",
          "valueBoolean": true
        },{
          "name": "expungePreviousVersions",
          "valueBoolean": true
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json+fhir'
      }
    });
  } catch (err) {
    if (err.response && err.response.data) {
      console.error(JSON.stringify(err.response.data));
    }

    throw err;
  }
}
