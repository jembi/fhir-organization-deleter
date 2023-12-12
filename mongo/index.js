import { MongoClient } from 'mongodb';
import { processBundle } from '../fhir/index.js';
import { writeMalformedResource } from '../filesystem/index.js';

// const client = new MongoClient('mongodb://mongo-1:27017,mongo-2:27017,mongo-3:27017/openhim?replicaSet=mongo-set');
// const client = new MongoClient('mongodb://localhost:27017');
const client = new MongoClient(process.env.MONGO_URL);

export async function processMongoData(patientIds) {
  await client.connect();
  const db = client.db('openhim');
  const transactionsCollection = db.collection('transactions');
  const fhirTransactions = transactionsCollection.find({
      'request.path': { $regex: '/fhir' },
      'request.method': { $eq: 'POST' },
      'status': "Successful",
    },
    {
      projection: {
        'request.body': true,
      }
    }
  );

  let processedCounter = 0;
  console.log('starting mongo processing');
  
  for await (const transaction of fhirTransactions) {
    processedCounter++;
    if (processedCounter % 1000 == 0) {
      console.log(`processed ${processedCounter} mongo requests`);
    }

    if (!transaction.request || !transaction.request.body || transaction.request.body === '') {
      writeMalformedResource(transaction._id.toString(), transaction);
      continue;
    }

    const fhirRequest = JSON.parse(transaction.request.body);
    processBundle(transaction._id.toString(), fhirRequest, patientIds);
  }

  console.log(`processed ${processedCounter} mongo requests`);
  console.log('done');
}

export function disconnect() {
  client.close();
}