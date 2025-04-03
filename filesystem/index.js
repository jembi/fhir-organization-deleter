import { parse } from 'csv-parse';
import { createReadStream, writeFile, access, constants, createWriteStream, existsSync } from 'fs';
import { join } from 'path';

const PATH_PREFIX = process.env.OUTPUT_PATH || './output';

const writeStreams = new Map();

export async function writePatientId(id, fileName) {
  if (!writePatientId[fileName]) writePatientId[fileName] = createWriteStream(`${PATH_PREFIX}/${fileName}`);
  await new Promise((resolve) =>
    writePatientId[fileName].write(`${id}\n`, resolve)
  );
}

export function writePatientResourcesToFile(resources) {
  return new Promise((resolve, reject) => {
    writeFile(`${PATH_PREFIX}/patient-resources.json`, JSON.stringify(resources), (err) => {
      if (err) reject(err);
      else resolve(true);
    })
  })
}

export async function flushCursor(cursor) {
  await new Promise((resolve, reject) => {
    writeFile(`${PATH_PREFIX}/cursor.dat`, cursor, (err) => {
      if (err) return reject(err);
      resolve();
    })
  })
}

export function getCursor() {
  return new Promise((resolve, reject) => {
    access(`${PATH_PREFIX}/cursor.dat`, constants.F_OK, (err) => {
      // file does not exist so no previous cursor
      if (err) return resolve('');

      readFile(`${PATH_PREFIX}/cursor.dat`, (err, data) => {
        if (err) return reject(err);
        return resolve(data.toString());
      })
    })
  })
}

export function doesFileExist(filePath) {
  try {
    // Use synchronous check to avoid callback issues
    return existsSync(filePath);
  } catch (err) {
    // Handle any unexpected errors (e.g., permissions)
    console.error(`Error checking if file exists at ${filePath}:`, err);
    return false;
  }
}

export async function readResourceIdsFromCsv(filePath) {
  try {
    // Check if file exists before attempting to read
    if (!doesFileExist(filePath)) {
      console.log(`File does not exist at ${filePath}, returning empty array`);
      return [];
    }

    const resourceIds = [];
    
    // Create a promise that resolves when parsing is complete
    const parsePromise = new Promise((resolve, reject) => {
      createReadStream(filePath)
        .pipe(parse({
          delimiter: ',',
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (row) => {
          const resourceId = row.id;
          if (resourceId) {
            resourceIds.push(resourceId);
          }
        })
        .on('end', () => {
          resolve(resourceIds);
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    await parsePromise;
    console.log(`Successfully read ${resourceIds.length} resource IDs from CSV`);
    return resourceIds;
  } catch (err) {
    console.error('Failed to read resource IDs from CSV:', err);
    throw err;
  }
}

export async function bulkWriteResourceIds(ids, fileName) {
  try {
    if (!ids || ids.length === 0) {
      console.warn('No IDs provided to write');
      return;
    }

    // Get or create write stream
    let writeStream = writeStreams.get(fileName);
    if (!writeStream) {
      const filePath = join(PATH_PREFIX, fileName);
      writeStream = createWriteStream(filePath);
      writeStreams.set(fileName, writeStream);
      
      // Write header for new file
      await new Promise((resolve, reject) => {
        writeStream.write('id\n', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Write all IDs in bulk
    const content = ids.map(id => `${id}\n`).join('');
    await new Promise((resolve, reject) => {
      writeStream.write(content, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  } catch (err) {
    console.error(`Error bulk writing IDs to file ${fileName}:`, err);
    throw err;
  }
}

// Clean up function to close all write streams
export async function closeWriteStreams() {
  const closePromises = [];
  for (const [fileName, stream] of writeStreams) {
    closePromises.push(
      new Promise((resolve, reject) => {
        stream.end((err) => {
          if (err) {
            console.error(`Error closing stream for ${fileName}:`, err);
            reject(err);
          } else {
            resolve();
          }
        });
      })
    );
  }
  await Promise.all(closePromises);
  writeStreams.clear();
}
