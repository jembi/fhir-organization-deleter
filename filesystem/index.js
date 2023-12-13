import fs from 'fs';
import readline from 'readline';
import fhirTypes from '../fhir/types.js';

let patientStream
let encounterStream
let relatedPersonStream
let medicationDispenseStream
let serviceRequestStream
let observationStream
let careplanStream
let diagnosticReportStream
let procedureStream
let medicationStatementStream
let questionnaireResponseStream
let unknownStream
let malformedStream

export function openWriteStreams() {
  patientStream = fs.createWriteStream('./output/0-patient.csv');
  encounterStream = fs.createWriteStream('./output/1-encounter.csv');
  relatedPersonStream = fs.createWriteStream('./output/2-relatedPerson.csv');
  medicationDispenseStream = fs.createWriteStream('./output/3-medicationDispense.csv');
  careplanStream = fs.createWriteStream('./output/4-careplan.csv');
  observationStream = fs.createWriteStream('./output/5-observation.csv');
  serviceRequestStream = fs.createWriteStream('./output/6-serviceRequest.csv');
  diagnosticReportStream = fs.createWriteStream('./output/7-diagnosticReport.csv');
  procedureStream = fs.createWriteStream('./output/8-procedure.csv');
  medicationStatementStream = fs.createWriteStream('./output/9-medicationStatement.csv');
  questionnaireResponseStream = fs.createWriteStream('./output/10-questionnaireResponse.csv');
  unknownStream = fs.createWriteStream('./output/11-unknown.csv');
  malformedStream = fs.createWriteStream('./output/12-malformed.csv');
}

export function writeResourceId(resource, id) {
  switch (resource) {
    case fhirTypes.Patient:
      patientStream.write(`Patient/${id}\n`);
      break;
    case fhirTypes.Encounter:
      encounterStream.write(`Encounter/${id}\n`);
      break;
    case fhirTypes.RelatedPerson:
      relatedPersonStream.write(`RelatedPerson/${id}\n`);
      break;
    case fhirTypes.MedicationDispense:
      medicationDispenseStream.write(`MedicationDispense/${id}\n`);
      break;
    case fhirTypes.ServiceRequest:
      serviceRequestStream.write(`ServiceRequest/${id}\n`);
      break;
    case fhirTypes.Observation:
      observationStream.write(`Observation/${id}\n`);
      break;
    case fhirTypes.CarePlan:
      careplanStream.write(`CarePlan/${id}\n`);
      break;
    case fhirTypes.DiagnosticReport:
      diagnosticReportStream.write(`DiagnosticReport/${id}\n`);
      break;
    case fhirTypes.Procedure:
      procedureStream.write(`Procedure/${id}\n`);
      break;
    case fhirTypes.MedicationStatement:
      medicationStatementStream.write(`MedicationStatement/${id}\n`);
      break;
    case fhirTypes.QuestionnaireResponse:
      questionnaireResponseStream.write(`QuestionnaireResponse/${id}\n`);
      break;
    default:
      unknownStream.write(`${resource}/${id}\n`);
      break;
  }
}

export function writeMalformedResource(transactionId, resource) {
  malformedStream.write(`Failed to process transaction: ${transactionId}\n`);
  malformedStream.write(JSON.stringify(resource));
  malformedStream.write('\n\n');
}

export function writeSqlConflictResource(resource) {
  if (!writeSqlConflictResource.writer)
    writeSqlConflictResource.writer = fs.createWriteStream('./output/sqlconflicts.csv');
  
    writeSqlConflictResource.writer.write(`${resource}\n`);
}

export async function readElasticPatientIds() {
  return new Promise((resolve, reject) => {
    fs.readFile('./output/elastic-patients.csv', (err, data) => {
      if (err) reject(err);
      const ids = data.toString().split('\n');
      const idsMap = new Map();
      for (const id of ids) {
        if (id !== '') idsMap.set(id, true);
      }

      resolve(idsMap);
    })
  })
}

export async function processFile(fileName, callback) {
  const reader = readline.createInterface({
    input: fs.createReadStream(`./output/${fileName}`)
  });

  for await (const line of reader) {
    await callback(line);
  }
}