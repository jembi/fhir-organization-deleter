if (!process.env.FACILITY_ID) process.env.FACILITY_ID = '18d5a42102424a9586867549b5abb350';
if (!process.env.CLICKHOUSE_URL) process.env.CLICKHOUSE_URL = 'http://localhost:8124'
if (!process.env.CLICKHOUSE_USERNAME) process.env.CLICKHOUSE_USERNAME = 'default';
if (!process.env.CLICKHOUSE_PASSWORD) process.env.CLICKHOUSE_PASSWORD = 'dev_password_only';
if (!process.env.ELASTIC_URL) process.env.ELASTIC_URL = 'http://localhost:9201'
if (!process.env.ELASTIC_PASSWORD) process.env.ELASTIC_PASSWORD = 'dev_password_only';
if (!process.env.HAPI_FHIR_URL) process.env.HAPI_FHIR_URL = 'localhost';
if (!process.env.HAPI_FHIR_PORT) process.env.HAPI_FHIR_PORT = 3447;
if (!process.env.OUTPUT_PATH) process.env.OUTPUT_PATH = './output';
if (!process.env.PATIENT_ID_FILENAME) process.env.PATIENT_ID_FILENAME = 'patient-ids.csv';
if (!process.env.FAILED_PATIENT_FILENAME) process.env.FAILED_PATIENT_FILENAME = 'failed-patients.csv';
if (!process.env.DELETED_RESOURCE_FILENAME) process.env.DELETED_RESOURCE_FILENAME = 'deleted-resources.csv';
if (!process.env.MAX_RETIRES) process.env.MAX_RETIRES = 10;
if (!process.env.AXIOS_TIMEOUT) process.env.AXIOS_TIMEOUT = 60000;
