# Organization Deleter - How To Guide

This guide provides step-by-step instructions for using the organization-deleter tool to completely remove an organization and all its associated data from the FHIR system.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Running Locally](#running-locally)
5. [Running on QA Environment](#running-on-qa-environment)
6. [Running on Production](#running-on-production)
7. [Data Expunging](#data-expunging)
8. [Troubleshooting](#troubleshooting)
9. [File Structure](#file-structure)

## Overview

The organization-deleter is a console application that:
- Scrapes all data attached to a specific organization
- Sends delete requests to each resource
- Removes the organization end-to-end
- Optionally expunges deleted data permanently

The process is divided into three main phases:
1. **Phase 1**: Extract and delete all resources for patients in the organization
2. **Phase 2**: Finalize by deleting patients and the organization itself
3. **Phase 3**: Expunge deleted data (optional)

## Prerequisites

Before running the organization-deleter, ensure you have:

- **Node.js** (version 18 or higher)
- **npm** package manager
- **Docker** (for QA and production environments)
- **Access** to the target FHIR system
- **Proper permissions** to delete resources
- **Backup** of the organization data (recommended)

## Environment Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd fhir-organization-deleter

# Install dependencies
npm install
```

### 2. Create Output Directory

```bash
# Create the output folder at the root level
mkdir output
```

### 3. Environment Variables

The application uses several environment variables. Key ones include:

- `FACILITY_ID`: Target health facility/organization ID
- `OUTPUT_PATH`: Path for output files (default: `./output`)
- `HAPI_FHIR_URL`: FHIR server URL
- `ELASTIC_URL`: Elasticsearch URL
- `CLICKHOUSE_URL`: ClickHouse URL

## Running Locally

### Step 1: Configure the Target Organization

1. Open `1-delete.js` in your code editor
2. Update the `FACILITY_ID` variable to your target health facility ID:
   ```javascript
   const healthFacilityId = 'your-organization-id-here';
   ```

### Step 2: Run Phase 1 - Resource Deletion

```bash
npm run 1:delete
```

This command will:
- Pull all patients from the specified facility
- Extract all resources for those patients
- Delete all resources for each patient
- Process patients in batches of 2000
- Handle ClickHouse data deletion

**Expected Output:**
- `patient-ids.csv`: List of all patient IDs in the organization
- Progress logs showing processed patients
- Completion time and statistics

### Step 3: Run Phase 2 - Finalization

```bash
npm run 2:finalize
```

This command will:
- Check if patients are safe to delete (no remaining resources)
- Delete patients from HAPI-FHIR and fhir-enrich-reports
- Write failed patients to `failed-patients.csv` if resources are still attached
- Delete the organization if all patients were successfully removed
- Handle ClickHouse cleanup

**Expected Output:**
- `failed-patients.csv`: Patients that couldn't be deleted (if any)
- Organization deletion confirmation
- Completion statistics

## Running on QA Environment

### Step 1: Configure Docker Environment

1. Open `docker/1-delete-docker-compose.yml`
2. Update the `FACILITY_ID` environment variable:
   ```yaml
   environment:
     FACILITY_ID: 'your-organization-id-here'
   ```

### Step 2: Run Phase 1 - Resource Deletion

```bash
npm run 1:delete:docker
```

This deploys the deletion process as a Docker stack.

### Step 3: Run Phase 2 - Finalization

```bash
npm run 2:finalize:docker
```

This deploys the finalization process as a Docker stack.

## Running on Production

### Step 1: Configure Production Environment

1. Open `docker/1-delete-docker-compose.yml`
2. Update the `FACILITY_ID` environment variable
3. **Important**: Update the `ELASTIC_PASSWORD` to the production version:
   ```yaml
   environment:
     ELASTIC_PASSWORD: 'your-production-elastic-password'
   ```

### Step 2: Run Phase 1 - Resource Deletion

```bash
npm run 1:delete:docker
```

### Step 3: Run Phase 2 - Finalization

```bash
npm run 2:finalize:docker
```

## Data Expunging

**Warning**: Expunging permanently removes data and cannot be undone.

### Step 1: Generate Deleted Resources File

You need a file containing all deleted resources in the format `resource_type/resource_id` (e.g., `Careplan/12345`).

**Option A: Database Query**
Run this query on the HAPI-FHIR database:
```sql
COPY (
  SELECT concat_ws('/', res_type, forced_id) 
  FROM hfj_forced_id 
  JOIN hfj_resource ON resource_pid = res_id 
  WHERE res_deleted_at IS NOT NULL
) TO '/tmp/output.csv';
```

**Option B: Extend the Codebase**
- Connect directly to the HAPI-FHIR database
- Query for deleted resources
- Add scrolling support for large datasets (10+ million resources)

### Step 2: Prepare for Expunging

1. Copy the generated CSV file to the `output` folder
2. Update the `DELETED_RESOURCE_FILENAME` environment variable in the Docker compose file:
   ```yaml
   environment:
     DELETED_RESOURCE_FILENAME: 'your-csv-filename.csv'
   ```

### Step 3: Run Expunging

```bash
npm run 3:expunge:docker
```

### Step 4: Check Results

- Review `expunge-fail.csv` for any resources that failed to expunge
- Retry failed resources if necessary

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Ensure you have proper access to the FHIR system
   - Check authentication credentials

2. **Resource Still Attached**
   - Check `failed-patients.csv` for patients that couldn't be deleted
   - Manually review and clean up remaining resources

3. **Docker Network Issues**
   - Ensure Docker networks (`hapi-fhir_public`, `elastic_public`, `clickhouse_public`) exist
   - Check network connectivity between services

4. **Timeout Errors**
   - Increase `AXIOS_TIMEOUT` in environment variables
   - Check network connectivity

### Monitoring Progress

- Check the `output` folder for generated files
- Monitor console logs for progress updates
- Review error logs for any issues

### Recovery

If the process fails:
1. Check the cursor file in the output directory
2. Restart from the last successful point
3. Review failed patients and resources
4. Manually clean up if necessary

## File Structure

```
fhir-organization-deleter/
├── 1-delete.js                 # Phase 1: Resource deletion
├── 2-finalizer.js              # Phase 2: Finalization
├── 3-expunge.js                # Phase 3: Data expunging
├── docker/                     # Docker compose files
│   ├── 1-delete-docker-compose.yml
│   ├── 2-finalizer-docker-compose.yml
│   └── 3-expunge-docker-compose.yml
├── env/                        # Environment configuration
├── fhir/                       # FHIR-related functions
├── elastic/                    # Elasticsearch functions
├── clickhouse/                 # ClickHouse functions
├── filesystem/                 # File system utilities
├── output/                     # Output files (created during execution)
├── package.json                # Dependencies and scripts
└── README.md                   # Original documentation
```

## Important Notes

- **Always backup** organization data before deletion
- **Test** the process on a non-production environment first
- **Monitor** the process closely, especially in production
- **Verify** completion by checking output files and logs
- **Document** any issues or failures for future reference

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the generated log files
3. Contact the development team with specific error messages and context 