# organization-deleter
Small console app which scrapes all data attached to an organization and will then send delete requests to each of the resources, effectively removing the organization end to end

## Running Locally
1. Make sure the output folder exists at the root level
2. Update FACILITY_ID in `1-delete.js` to the target health facility
3. Install node modules `npm install`
4. Run `npm run 1:delete` - This will pull all the patients from the set facility and then get + delete all the resources for those patients
5. Once step one is finished run `npm run 2:finalize` - This will go back and delete all the patients in hapi-fhir and fhir-enrich-reports (writing to a failure file if resources are still attached) and finally the organization if all patients were safe to delete.

## Running on QA
1. Make sure the output folder exists at the root level
2. Update FACILITY_ID in `docker/1-delete-docker-compose.yml` to the target health facility
3. Install node modules `npm install`
4. Run `npm run 1:delete:docker` - This will pull all the patients from the set facility and then get + delete all the resources for those patients
5. Once step one is finished run `npm run 2:finalize:docker` - This will go back and delete all the patients in hapi-fhir and fhir-enrich-reports (writing to a failure file if resources are still attached) and finally the organization if all patients were safe to delete.

## Running on Prod
1. Make sure the output folder exists at the root level
2. Update FACILITY_ID in `docker/1-delete-docker-compose.yml` to the target health facility
3. Install node package `npm install`
4. Update the elastic password in `docker/1-delete-docker-compose.yml` to be the production version
5. Run `npm run 1:delete:docker` - This will pull all the patients from the set facility and then get + delete all the resources for those patients
6. Once step one is finished run `npm run 2:finalize:docker` - This will go back and delete all the patients in hapi-fhir and fhir-enrich-reports (writing to a failure file if resources are still attached) and finally the organization if all patients were safe to delete.
