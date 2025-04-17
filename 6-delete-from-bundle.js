import fs from 'fs/promises';
import { doesResourceExist, checkAndDeleteResource } from './fhir/index.js';
import { bulkWriteResourceIds, readResourceIdsFromCsv } from './filesystem/index.js';
import axios from 'axios';
import { bulkDeleteResourcesForIds, resourceTypeMap } from './clickhouse/index.js';
import './env/index.js';

const BUNDLE_FILE = process.env.BUNDLE_FILE || './6800e06fff556743f77c3622_request.json';
const START_DATE = process.env.START_DATE || '2025-04-01T00:00:00Z';
const END_DATE = process.env.END_DATE || '2025-04-04T00:00:00Z';
const OUTPUT_PATH = process.env.OUTPUT_PATH || './output';

const axiosInstance = axios.create({
  baseURL: `http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Order of resources to delete based on typical FHIR dependencies
const RESOURCE_DELETE_ORDER = [
  'QuestionnaireResponse',
  'ServiceRequest',
  'Observation',
  'Procedure',
  'MedicationStatement',
  'MedicationDispense',
  'DiagnosticReport',
  'CarePlan',
  'Encounter'
];

async function processBundleFile() {
  try {
    console.log(`${new Date().toISOString()} - Starting bundle processing`);
    
    // Read and parse the bundle file
    const bundleContent = await fs.readFile(BUNDLE_FILE, 'utf8');
    const bundle = JSON.parse(bundleContent);
    
    // Track resources by type
    const resourcesByType = new Map();
    
    // Process bundle
    if (bundle.resourceType !== 'Bundle' || !bundle.entry) {
      console.warn('Invalid bundle format, skipping:', bundle.id);
    }

    // Process each entry in the bundle
    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (!resource || !resource.resourceType || !resource.id) {
        console.warn('Invalid resource in bundle, skipping');
        continue;
      }

      // Add to tracking map
      if (!resourcesByType.has(resource.resourceType)) {
        resourcesByType.set(resource.resourceType, new Set());
      }
      resourcesByType.get(resource.resourceType).add(resource.id);
    }

    // Check each resource in HAPI FHIR and write results
    for (const [resourceType, ids] of resourcesByType) {
      console.log(`Checking ${ids.size} ${resourceType} resources`);
      
      const singleVersionIds = [];
      const multiVersionIds = [];
      const missingIds = [];

      for (const id of ids) {
        try {
          // Check if resource exists first
          const exists = await doesResourceExist(resourceType, id);
          if (!exists) {
            missingIds.push(id);
            continue;
          }

          // Get resource history with date range
          const historyUrl = `http://${process.env.HAPI_FHIR_URL}:${process.env.HAPI_FHIR_PORT}/fhir/${resourceType}/${id}/_history` +
            `?_lastUpdated=gt${START_DATE}` +
            `&_lastUpdated=lt${END_DATE}`;
          const response = await axiosInstance.get(historyUrl);

          // Check number of versions
          if (response.data && response.data.entry) {
            const versionCount = response.data.entry.length;
            if (versionCount === 1) {
              singleVersionIds.push(id);
            } else {
              multiVersionIds.push(id);
            }
          }
        } catch (err) {
          console.error(`Error checking history for ${resourceType}/${id}:`, err.message);
          // Add to missing if we can't check history
          missingIds.push(id);
        }
      }

      // Write results to files
      if (singleVersionIds.length > 0) {
        await bulkWriteResourceIds(
          singleVersionIds,
          `single-version-${resourceType.toLowerCase()}-resources.csv`
        );
      }

      if (multiVersionIds.length > 0) {
        await bulkWriteResourceIds(
          multiVersionIds,
          `multi-version-${resourceType.toLowerCase()}-resources.csv`
        );
      }

      if (missingIds.length > 0) {
        await bulkWriteResourceIds(
          missingIds,
          `missing-${resourceType.toLowerCase()}-resources.csv`
        );
      }

      console.log(`${resourceType} results:
        - Single Version: ${singleVersionIds.length}
        - Multiple Versions: ${multiVersionIds.length}
        - Missing/Error: ${missingIds.length}`);
    }
    
    console.log(`${new Date().toISOString()} - Finished processing bundles`);
  } catch (err) {
    console.error('Error processing bundle file:', err);
    throw err;
  }
}

async function deleteSingleVersionResources() {
  try {
    console.log(`${new Date().toISOString()} - Starting deletion of single-version resources`);
    
    const deletedByType = new Map();
    const failedByType = new Map();
    const clickhouseFailedByType = new Map();

    // Process resources in order to handle dependencies
    for (const resourceType of RESOURCE_DELETE_ORDER) {
      const fileName = `${OUTPUT_PATH}/single-version-${resourceType.toLowerCase()}-resources.csv`;
      
      try {
        const resourceIds = await readResourceIdsFromCsv(fileName);
        if (!resourceIds.length) {
          console.log(`No single-version ${resourceType} resources to delete`);
          continue;
        }

        console.log(`Processing ${resourceIds.length} ${resourceType} resources`);
        
        const deleted = [];
        const failed = [];
        const clickhouseFailed = [];

        // Process each resource
        for (const id of resourceIds) {
          try {
            // Delete from HAPI FHIR first
            await checkAndDeleteResource(`${resourceType}/${id}`);
            
            // If HAPI deletion successful, delete from Clickhouse
            try {
              const tableName = resourceTypeMap[resourceType.toLowerCase()] || resourceType.toLowerCase();
              await bulkDeleteResourcesForIds(tableName, [id]);
              deleted.push(id);
            } catch (clickhouseErr) {
              console.error(`Failed to delete ${resourceType}/${id} from Clickhouse:`, clickhouseErr.message);
              clickhouseFailed.push(id);
            }
          } catch (hapiFhirErr) {
            console.error(`Failed to delete ${resourceType}/${id} from HAPI FHIR:`, hapiFhirErr.message);
            failed.push(id);
          }

          // Add small delay to prevent overwhelming the servers
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Store results
        if (deleted.length > 0) {
          deletedByType.set(resourceType, deleted);
          await bulkWriteResourceIds(
            deleted,
            `deleted-${resourceType.toLowerCase()}-resources.csv`
          );
        }

        if (failed.length > 0) {
          failedByType.set(resourceType, failed);
          await bulkWriteResourceIds(
            failed,
            `failed-hapifhir-delete-${resourceType.toLowerCase()}-resources.csv`
          );
        }

        if (clickhouseFailed.length > 0) {
          clickhouseFailedByType.set(resourceType, clickhouseFailed);
          await bulkWriteResourceIds(
            clickhouseFailed,
            `failed-clickhouse-delete-${resourceType.toLowerCase()}-resources.csv`
          );
        }

        console.log(`${resourceType} deletion results:
          - Successfully deleted from both systems: ${deleted.length}
          - Failed HAPI FHIR deletion: ${failed.length}
          - Failed Clickhouse deletion: ${clickhouseFailed.length}`);

      } catch (err) {
        console.error(`Error processing ${resourceType}:`, err);
        continue;
      }
    }

    // Print summary
    console.log('\nDeletion Summary:');
    for (const [type, ids] of deletedByType) {
      console.log(`${type}: ${ids.length} successfully deleted from both systems`);
    }
    for (const [type, ids] of failedByType) {
      console.log(`${type}: ${ids.length} failed HAPI FHIR deletion`);
    }
    for (const [type, ids] of clickhouseFailedByType) {
      console.log(`${type}: ${ids.length} failed Clickhouse deletion`);
    }

  } catch (err) {
    console.error('Error in deletion process:', err);
    throw err;
  }
}

// Run the script
processBundleFile()
  .then(() => {
    console.log(`${new Date().toISOString()} - Finished processing bundles`);
    return deleteSingleVersionResources();
  })
  .then(() => {
    console.log(`${new Date().toISOString()} - Finished processing deletions`);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
