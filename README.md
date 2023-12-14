# organization-deleter
Small console app which scrapes all data attached to an organization and will then send delete requests to each of the resources, effectively removing the organization end to end

## Running Locally
1. Make sure the output folder exists at the root level
2. Update FACILITY_ID in `1-extract.js` to the target health facility
3. Install node modules `npm run install`
4. Run `npm run 1:delete` - This will pull all the patients from the set facility and then get + delete all the resources for those patients
5. TODO: implement step 2 which will go and delete all fhir-enrich reports + delete the patient + delete the organization

## Running on QA
1. Make sure the output folder exists at the root level
2. Update FACILITY_ID in `docker/1-extract-docker-compose.yml` to the target health facility
3. Install node modules `npm run install`
4. Run `npm run 1:delete:docker` - This will pull all the patients from the set facility and then get + delete all the resources for those patients
5. TODO: implement step 2 which will go and delete all fhir-enrich reports + delete the patient + delete the organization

## Running on Prod
1. Make sure the output folder exists at the root level
2. Update FACILITY_ID in `docker/1-extract-docker-compose.yml` to the target health facility
3. Install node package `npm run install`
4. Update the elastic password in `docker/1-extract-docker-compose.yml` to be the production version
5. Run `npm run 1:delete:docker` - This will pull all the patients from the set facility and then get + delete all the resources for those patients
6. TODO: implement step 2 which will go and delete all fhir-enrich reports + delete the patient + delete the organization
