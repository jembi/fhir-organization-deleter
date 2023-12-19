import fs from 'fs';

const PATH_PREFIX = process.env.OUTPUT_PATH || './output';

export async function writePatientId(id, fileName) {
  if (!writePatientId[fileName]) writePatientId[fileName] = fs.createWriteStream(`${PATH_PREFIX}/${fileName}`);
  await new Promise((resolve) =>
    writePatientId[fileName].write(`${id}\n`, resolve)
  );
}

export function writePatientResourcesToFile(resources) {
  return new Promise((resolve, reject) => {
    fs.writeFile(`${PATH_PREFIX}/patient-resources.json`, JSON.stringify(resources), (err) => {
      if (err) reject(err);
      else resolve(true);
    })
  })
}

export async function flushCursor(cursor) {
  await new Promise((resolve, reject) => {
    fs.writeFile(`${PATH_PREFIX}/cursor.dat`, cursor, (err) => {
      if (err) return reject(err);
      resolve();
    })
  })
}

export function getCursor() {
  return new Promise((resolve, reject) => {
    fs.access(`${PATH_PREFIX}/cursor.dat`, fs.constants.F_OK, (err) => {
      // file does not exist so no previous cursor
      if (err) return resolve('');

      fs.readFile(`${PATH_PREFIX}/cursor.dat`, (err, data) => {
        if (err) return reject(err);
        return resolve(data.toString());
      })
    })
  })
}
