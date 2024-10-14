import axios from 'axios';
import { writePatientId, writePatientResourcesToFile } from '../filesystem/index.js';
import { deleteElasticRawResources } from '../elastic/index.js';
import { deleteClickhousePatientData } from '../clickhouse/index.js';
import types from '../fhir/types.js';

const axiosInstance = axios.create({ timeout: Number(process.env.AXIOS_TIMEOUT) || 60000 })

export async function extractPatientIds(healthFacilityId, nextURL) {
  // Use nextUrl if provided, otherwise create the initial URL
  const count = 1900; // Set the number of patients to extract
  const counter = 0;

  const url = nextURL 
    ? nextURL 
    : `http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/Patient?organization=${healthFacilityId}&_elements=_id&_count=${count}`;
  const response = await axios.get(url);

  if (response.data && response.data.entry) {
    // Assuming that entry is an array of patient records
    const entries = response.data.entry.map(entry => entry.resource.id);
    for (const entry of entries) {
      await writePatientId(entry, process.env.PATIENT_ID_FILENAME); // Assuming you have a function to write each patient ID
    }

    // Return the URL for the next batch if available
    const nextLink = response.data.link.find(link => link.relation === 'next');

    // // If there is a next URL and the counter is less than 5, call extractPatientIds recursively
    // if (nextLink && counter < 5) {
    //   return extractPatientIds(healthFacilityId, nextLink.url, counter + 1);
    // }

    return nextLink ? nextLink.url : null; // Return the next URL or null if no more pages
  }

  return null; // No more patients
}

export async function checkAndDeleteResource(resourcePath, patientId, processedResources = new Set()) {
  if (processedResources.has(resourcePath)) {
    return; // Prevent circular references or repeated deletion attempts
  }
  processedResources.add(resourcePath); // Mark this resource as processed
  
  try {
    await deleteResource(resourcePath);
  } catch (error) {
    if (error.response && error.response.status === 409) {
      const operationOutcome = error.response.data;

      // Ensure it's an OperationOutcome resource
      if (operationOutcome && operationOutcome.resourceType === 'OperationOutcome') {
        const issues = operationOutcome.issue;

        for (const issue of issues) {
          // Check for specific FHIR error codes, like 'processing'
          if (issue.severity === 'error' && issue.code === 'processing') {
            // If there is a reference in the diagnostics or details, extract it
            let referencedResourcePath = null;

            // Try to extract from diagnostics
            if (issue.diagnostics && issue.diagnostics.includes('because at least one resource has a reference to this resource')) {
              referencedResourcePath = issue.diagnostics.match(/resource ([^ ]+) in path/)[1];
            }

            // Check in the details as well
            if (!referencedResourcePath && issue.details && issue.details.text) {
              referencedResourcePath = issue.details.text.match(/resource ([^ ]+) in path/)[1];
            }

            // If a referenced resource is found, attempt to delete it first
            if (referencedResourcePath) {
              console.log(`Found reference to ${resourcePath}. Deleting referencing resource: ${referencedResourcePath}`);
              
              // Delete the referencing resource first
              await checkAndDeleteResource(referencedResourcePath, patientId, processedResources);

              // Retry deleting the original resource after resolving the reference
              await checkAndDeleteResource(resourcePath, patientId, processedResources);
              return;
            }
          }
        }
      }
    } else {
      // If it's a different error, re-throw it
      throw error;
    }
  }
}


export async function deleteResources(patientId) {
  const deleteFhirResources = async (resources) => {
    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: resources.map(resource => {
        return {
          "request": {
           "method": "DELETE",
           "url": `${resource.resource.resourceType}/${resource.resource.id}`
         } 
       }
      })
    }

    const url = `http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir`

    await axios.post(url, bundle);
  }
  const processResources = async (url, tries=3) => {
    try {
      const response = await axiosInstance.get(url);

      if (response.data && response.data.entry?.length) {
        await deleteFhirResources(response.data.entry);

        await deleteElasticRawResources(response.data.entry)
      }

      const next = response.data.link?.filter(link => link.relation === 'next');
      if (next.length) {
        return await processResources(url, tries=3);
      } else {
        console.log('Done processing batch')
        return 'done';
      } 
    } catch (error) {
      console.log('Iam shsh', error)
      if (tries >= 0) {
        await processResources(url, tries-1);
      } else {

        /// TODO should write to a file
        // writePatientResourcesToFile()
      }
    }
  }

  const resources = ['DiagnosticReport', 'QuestionnaireResponse', 'Observation', 'MedicationStatement', 'MedicationDispense', 'Procedure', 'ServiceRequest', 'CarePlan', 'RelatedPerson', 'Encounter']

  for (let index = 0; index < resources.length; index++) {
    const element = resources[index];
    const count = 200;
    const url = `http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/${element}?patient=${patientId}&_elements=_id&_count=${count}`
    console.log(`Processing ${element}, for ${patientId}`)
    await processResources(url);
    console.log('Done processing')
  }
}

export async function deleteResource(resource, retries = 0, processedResources = new Set()) {
  try {
    // Add a short delay to avoid rate-limiting issues
    await new Promise((resolve) => setTimeout(() => resolve(), 10));

    // Execute the delete request
    await axiosInstance.delete(`http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/${resource}`);

    console.log(`Successfully deleted resource: ${resource}`);
  } catch (err) {
    if (err.code && err.code === 'ECONNABORTED') {
      // Handle network timeout and retry
      if (retries < Number(process.env.MAX_RETRIES || 10)) {
        console.warn(`HAPI-FHIR timeout hit for DELETE ${resource}, retrying... (Attempt ${retries + 1})`);
        return deleteResource(resource, ++retries, processedResources);
      }
    }

    if (err.response && err.response.status === 409) {
      const operationOutcome = err.response.data;
      
      // Ensure it's an OperationOutcome response
      if (operationOutcome && operationOutcome.resourceType === 'OperationOutcome') {
        const issues = operationOutcome.issue;

        for (const issue of issues) {
          // Handle errors related to resource references
          if (issue.severity === 'error' && issue.code === 'processing') {
            let referencedResourcePath = null;

            // Try to extract the referenced resource from diagnostics or details
            if (issue.diagnostics && issue.diagnostics.includes('because at least one resource has a reference to this resource')) {
              referencedResourcePath = issue.diagnostics.match(/resource ([^ ]+) in path/)[1];
            }

            if (!referencedResourcePath && issue.details && issue.details.text) {
              referencedResourcePath = issue.details.text.match(/resource ([^ ]+) in path/)[1];
            }

            if (referencedResourcePath) {
              console.log(`Resource ${resource} cannot be deleted due to reference from ${referencedResourcePath}. Deleting the reference first...`);
              
              // Recursively delete the referenced resource first
              if (!processedResources.has(referencedResourcePath)) {
                processedResources.add(referencedResourcePath);
                await deleteResource(referencedResourcePath, 0, processedResources);
              }

              // Retry deleting the original resource after the reference is resolved
              return await deleteResource(resource, retries, processedResources);
            }
          }
        }
      }
    }

    // Log the response data for other errors and re-throw
    if (err.response && err.response.data) {
      console.error(`Failed to delete resource ${resource}:`, JSON.stringify(err.response.data));
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

export async function expungeResource(resource, retries = 0) {
  try {
    await new Promise((resolve) => setTimeout(() => { resolve() }, 10));
    await axiosInstance.post(`http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/${resource}/$expunge`, {
      resourceType: "Parameters",
      parameter: [
        {
          name: "limit",
          valueInteger: 1000
        },{
          name: "expungeDeletedResources",
          valueBoolean: true
        },{
          name: "expungePreviousVersions",
          valueBoolean: true
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json+fhir'
      }
    });
  } catch (err) {
    if (err.code && err.code === 'ECONNABORTED') {
      if (retries < Number(process.env.MAX_RETIRES || 10)) {
        console.warn(`Hapi-fhir timeout hit for EXPUNGE ${resource} trying again`);
        return expungeResource(resource, ++retries);
      }
    }

    if (err.response && err.response.data) {
      // calling expunge on either an already expunged resource
      // or it didnt exist originally so continue
      if (err.response.status === 404) return;
      
      console.error(JSON.stringify(err.response.data));
    }

    throw err;
  }
}
