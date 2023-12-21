import fs from 'fs';
import readline from 'readline';
import './env/index.js';
import { expungeResource } from './fhir/index.js';
import { flushCursor, getCursor } from './filesystem/index.js';

async function main() {
  console.log(`${new Date().toISOString()} - starting processing`);

  const cursor = await getCursor();
  if (cursor) console.log(`${new Date().toISOString()} - Found cursor ${cursor} resuming from there`);

  let previousCursorFound = cursor === '';
  const deletedResourceReader = readline.createInterface({
    input: fs.createReadStream(`${process.env.OUTPUT_PATH}/${process.env.DELETED_RESOURCE_FILENAME}`)
  });
  
  for await (const deletedResource of deletedResourceReader) {
    if (!previousCursorFound) {
      if (deletedResource === cursor) previousCursorFound = true;
      else continue;
    }

    await flushCursor(deletedResource);

    console.log(`${new Date().toISOString()} - expunging ${deletedResource}`);
    await expungeResource(deletedResource);
  }
  
  await flushCursor('');

  console.log(`${new Date().toISOString()} - finished processing`);
}

main()
  .catch(err => console.error(err))
