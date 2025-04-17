import './env/index.js';
import { getHapiFhirResourcesForPatientWithPagination } from './fhir/index.js';
import { getPatientIdsforFacility, getResourcesForPatient } from './clickhouse/index.js';
import { flushCursor, bulkWriteResourceIds } from './filesystem/index.js';

const RESOURCE_ID_FILENAME = process.env.RESOURCE_ID_FILENAME || 'ids.csv';
const HEALTH_FACILITY_ID = process.env.FACILITY_ID || '90e0848e-0674-4f3d-af15-8b2f43530453';
const PATIENT_ID_FILENAME = process.env.PATIENT_ID_FILENAME || 'patient-ids.csv';
const END_DATE = process.env.END_DATE || '2024-10-01';
const START_DATE = process.env.START_DATE || '1970-01-01';
const COUNT = process.env.COUNT || 2000;

const tableNames = ['care_plan', 'diagnostic_report', 'encounter', 'medication_dispense', 'medication_statement',
  'observation', 'procedure', 'questionnaire_response', 'service_request'];

const resourceTypes = ['CarePlan', 'DiagnosticReport', 'Encounter', 'MedicationDispense', 'MedicationStatement',
  'Observation', 'Procedure', 'QuestionnaireResponse', 'ServiceRequest'];

async function main() {
  const start = new Date().getTime();
  console.log(`${new Date().toISOString()} - starting processing`);
  
  const patientIds = await getPatientIdsforFacility(HEALTH_FACILITY_ID);
  console.log(`Found ${patientIds.length} patient ids for facility ${HEALTH_FACILITY_ID}`);

  await bulkWriteResourceIds(patientIds, PATIENT_ID_FILENAME);
  console.log(`Wrote ${patientIds.length} patient ids to ${PATIENT_ID_FILENAME}`);

  for(const resourceType in resourceTypes) {
    let resources = [];
    let resourceIds = [];

    for(const patientId of patientIds) {
      resources = await getResourcesForPatient(patientId, tableNames[resourceType], START_DATE, END_DATE);
      resourceIds = resourceIds.concat(resources);
    }
    console.log(`Found ${resourceIds.length} ${resourceTypes[resourceType]} resources for all patients in clickhouse`);

    let hapiFhirResources = [];
    for(const patientId of patientIds) {
      // Filter out resources that already exist in the Hapi FHIR server
      const resources = await getHapiFhirResourcesForPatientWithPagination(patientId, resourceTypes[resourceType], START_DATE, END_DATE, COUNT);
      if (resources.length > 0) {
        hapiFhirResources = hapiFhirResources.concat(resources);
      }
    }
    for(const resource of hapiFhirResources) {
      if(resourceIds.includes(resource)) {
        resourceIds.splice(resourceIds.indexOf(resource), 1);
      }
    }

    console.log(`Found ${hapiFhirResources.length} ${resourceTypes[resourceType]} resources to write for all patients in Hapi FHIR`);

    await bulkWriteResourceIds(resourceIds, `${tableNames[resourceType]}-${RESOURCE_ID_FILENAME}`);
    console.log(`Wrote ${resourceIds.length} ${resourceTypes[resourceType]} resources to ${tableNames[resourceType]}-${RESOURCE_ID_FILENAME}`);
  }

  await flushCursor('');

  console.log(`${new Date().toISOString()} - finished processing`);
  const end = new Date().getTime();
  const duration = (end - start) / 1000;
  console.log(`${new Date().toISOString()} - finished processing in ${duration} seconds`);
}

main()
  .catch(err => {
    console.error('Error in main process:', err);
    process.exit(1);
  });
