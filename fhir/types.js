const types = {
  Organization: 'organization',
  Medication: 'medication',
  Patient: 'patient',
  Encounter: 'encounter',
  RelatedPerson: 'relatedperson',
  MedicationDispense: 'medicationdispense',
  ServiceRequest: 'servicerequest',
  Observation: 'observation',
  CarePlan: 'careplan',
  DiagnosticReport: 'diagnosticreport',
  Procedure: 'procedure',
  MedicationStatement: 'medicationstatement',
  QuestionnaireResponse: 'questionnaireresponse',
}

Object.freeze(types);

export default types;