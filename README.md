# organization-deleter
Small console app which scrapes all data attached to an organization and will then send delete requests to each of the resources, effectively removing the organization end to end

## Running Locally
1. Make sure the output folder exists at the root level
2. Run `npm run 1:extract` - This will pull all the data and prepare the output data
3. Check the output folder to make sure there is no data in 11-unknown.csv or 12-malformed.csv (can also check the other output to see if it looks right)
4. Run `npm run 2:deleter` - This will act on the output data, sending delete requests for each resource in an order that hapi-fhir will allow

## Running on QA
1. Make sure the output folder exists at the root level
2. Run `npm run 1:extract:docker` - This will pull all the data and prepare the output data
3. Check the output folder to make sure there is no data in 11-unknown.csv or 12-malformed.csv (can also check the other output to see if it looks right)
4. Run `npm run 2:deleter:docker` - This will act on the output data, sending delete requests for each resource in an order that hapi-fhir will allow

## Running on Prod
1. Make sure the output folder exists at the root level
2. Update the elastic password in `docker/1-extract-docker-compose.yml` to be the production version
3. Run `npm run 1:extract:docker` - This will pull all the data and prepare the output data
4. Check the output folder to make sure there is no data in 11-unknown.csv or 12-malformed.csv (can also check the other output to see if it looks right)
5. Run `npm run 2:deleter:docker` - This will act on the output data, sending delete requests for each resource in an order that hapi-fhir will allow
