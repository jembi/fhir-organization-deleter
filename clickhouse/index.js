import { createClient } from '@clickhouse/client';

// Set up ClickHouse client
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8124',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'dev_password_only',
});

const resourceTypeMap = {
    medicationdispense: 'medication_dispense',
    careplan: 'care_plan',
    diagnosticreport: 'diagnostic_report',
    relatedperson: 'related_person',
    medicationstatement: 'medication_statement',
    questionnaireresponse: 'questionnaire_response',
    servicerequest: 'service_request',
  };


// Function to delete patient-related data from the raw database tables
export async function deleteClickhousePatientData(patientId) {
    const tables = [
      'care_plan', 'diagnostic_report', 'encounter', 'medication_dispense', 'medication_statement',
      'observation', 'procedure', 'questionnaire_response',
      'related_person', 'service_request'
    ];
  
    try {
        for (const table of tables) {
          let query = `
            ALTER TABLE raw.${table}
            DELETE 
            WHERE patient.reference = ['Patient/${patientId}'];
          `;
        
          try {
            // Attempt to delete using patient.reference
            await clickhouse.query({
                query,     // The query string
                format: 'JSON'  // Expected format
              });
            console.log(`Successfully deleted patient data from ${table} using patient.reference.`);
          } catch (err) {
            if (err.type === 'UNKNOWN_IDENTIFIER' && err.message.includes('patient.reference')) {
              console.warn(`'patient.reference' column missing in table ${table}. Trying with 'subject.reference'.`);
    
              // If patient.reference is missing, try deleting using subject.reference
              query = `
                ALTER TABLE raw.${table}
                DELETE 
                WHERE subject.reference = ['Patient/${patientId}'];
              `;
    
              // Execute the new query with subject.reference
              await clickhouse.query({
                query,     // The query string
                format: 'JSON'  // Expected format
              });
              console.log(`Successfully deleted patient data from ${table} using subject.reference.`);
            } else {
              // If it's a different error, rethrow
              throw err;
            }
          }
        }
      } catch (err) {
        console.error(`Failed to delete patient data from ClickHouse:`, err);
        throw err;
      }
  }

export async function deleteClickhousePatient(patientId) {

    try {
    
        let query = `
        ALTER TABLE raw.patient
        DELETE 
        WHERE id = '${patientId}';
        `;
    
        
        await clickhouse.query({
            query,     // The query string
            format: 'JSON'  // Expected format
            });
        console.log(`Successfully deleted patient from raw.patient using ${patientId}.`);
        
    
    } catch (err) {
    console.error(`Failed to delete patient data from ClickHouse:`, err);
    throw err;
    }
}

// Function to delete individual resource from a table in ClickHouse
export async function deleteClickhouseRawResources(resources) {
  try {
    for (const resource of resources) {
      let [type, id] = resource.split('/');

      // Apply the mapping for the correct table name
      type = resourceTypeMap[type.toLowerCase()] || type.toLowerCase();

      if (type == 'organization'){
        const query = `
        ALTER TABLE raw.patient
            DELETE WHERE managingOrganization.reference = ['Organization/${id}'];
        `;
        // Execute the query using exec() for non-SELECT queries
        await clickhouse.query({
            query,     // The query string
            format: 'JSON'  // Expected format
        });  
      }
      const query = `
      ALTER TABLE raw.${type}
        DELETE WHERE id = '${id}';
      `;
      // Execute the query using exec() for non-SELECT queries
      await clickhouse.query({
        query,     // The query string
        format: 'JSON'  // Expected format
      });
    }
    console.log('Successfully deleted resources from ClickHouse');
  } catch (err) {
    console.error('Failed to delete resources from ClickHouse:', err);
    throw err;
  }
}
