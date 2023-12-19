if (!process.env.FACILITY_ID) process.env.FACILITY_ID = '009a6a861c1b45778c0cbedadefe52a4';
if (!process.env.ELASTIC_URL) process.env.ELASTIC_URL = 'http://localhost:9201'
if (!process.env.ELASTIC_PASSWORD) process.env.ELASTIC_PASSWORD = 'dev_password_only';
if (!process.env.HAPI_FHIR_URL) process.env.HAPI_FHIR_URL = 'localhost';
if (!process.env.HAPI_FHIR_PORT) process.env.HAPI_FHIR_PORT = 3447;
if (!process.env.OUTPUT_PATH) process.env.OUTPUT_PATH = './output';
if (!process.env.PATIENT_ID_FILENAME) process.env.PATIENT_ID_FILENAME = 'patient-ids.csv';
if (!process.env.FAILED_PATIENT_FILENAME) process.env.FAILED_PATIENT_FILENAME = 'failed-patients.csv';
