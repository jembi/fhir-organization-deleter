import fs from 'fs';
import readline from 'readline';
import './env/index.js';
import { expungeResource } from './fhir/index.js';
import { flushCursor, getCursor, writePatientId } from './filesystem/index.js';

async function main() {
  console.log(`${new Date().toISOString()} - starting processing`);

  const cursor = await getCursor();
  if (cursor) console.log(`${new Date().toISOString()} - Found cursor ${cursor} resuming from there`);

  let previousCursorFound = cursor === '';
  const deletedResourceReader = readline.createInterface({
    input: fs.createReadStream(`${process.env.OUTPUT_PATH}/${process.env.DELETED_RESOURCE_FILENAME}`)
  });
  
  let processed = 0;
  for await (const deletedResource of deletedResourceReader) {
    if (!previousCursorFound) {
      if (deletedResource === cursor) previousCursorFound = true;
      else continue;
    }

    await flushCursor(deletedResource);

    try {
      await expungeResource(deletedResource);
    } catch (err) {
      console.log(`${new Date().toISOString()} - failed to expunge ${deletedResource} writing to failed file.`);
      writePatientId(deletedResource, 'expunge-fail.csv');
    }
    
    processed++;
    if (processed % 10000) {
      console.log(`${new Date().toISOString()} - expunged ${processed} resources`);
      console.log(`${new Date().toISOString()} - just finished processing ${deletedResource}`);
    }
  }
  
  await flushCursor('');

  console.log(`${new Date().toISOString()} - finished processing`);
}

main()
  .catch(err => console.error(err))
