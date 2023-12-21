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


## Expunging
In order to expunge the data, the application requires a file of all the deleted resources in the form `resource_type/resource_id` eg: `Careplan/12345`. In order to generate that file, you'll need to either extend this code base to connect to the hapi-fhir database directly and query it there, just be sure to add scrolling since you can have upwards of 10 million deleted resources. Alternatively you can run this query on the database itself and copy the file to the output folder. `COPY (  SELECT concat_ws('/', res_type, forced_id) FROM hfj_forced_id JOIN hfj_resource ON resource_pid = res_id where res_deleted_at IS NOT NULL ) TO '/tmp/output.csv';`
1. Copy the postgres output.csv file into the output folder
2. Set the `DELETED_RESOURCE_FILENAME` environment variable in the docker file to be the same as what you named the file that you copied into the output folder
3. Run `npm run 3:expunge:docker`