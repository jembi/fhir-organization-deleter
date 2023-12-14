import fs from 'fs';
import readline from 'readline';

export async function processFile(fileName, callback) {
  const reader = readline.createInterface({
    input: fs.createReadStream(`./output/${fileName}`)
  });

  for await (const line of reader) {
    await callback(line);
  }
}

export async function writePatientId(id) {
  if (!writePatientId.patientIdStream) writePatientId.patientIdStream = fs.createWriteStream('./output/patient-ids.csv');
  await new Promise((resolve) =>
    writePatientId.patientIdStream.write(`${id}\n`, resolve)
  );
}

export function writePatientResourcesToFile(resources) {
  return new Promise((resolve, reject) => {
    fs.writeFile('./output/patient-resources.json', JSON.stringify(resources), (err) => {
      if (err) reject(err);
      else resolve(true);
    })
  })
}

export async function flushCursor(cursor) {
  await new Promise((resolve, reject) => {
    fs.writeFile('./output/cursor.dat', cursor, (err) => {
      if (err) return reject(err);
      resolve();
    })
  })
}

export function getCursor() {
  return new Promise((resolve, reject) => {
    fs.access('./output/cursor.dat', fs.constants.F_OK, (err) => {
      // file does not exist so no previous cursor
      if (err) return resolve('');

      fs.readFile('./output/cursor.dat', (err, data) => {
        if (err) return reject(err);
        return resolve(data.toString());
      })
    })
  })
}
