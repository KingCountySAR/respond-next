import { MongoClient, Db } from 'mongodb'

let client: MongoClient | null = null
let db: Db | null = null

export async function connectDb(): Promise<Db> {
  if (db) return db

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')

  client = new MongoClient(uri)
  await client.connect()
  db = client.db(process.env.MONGODB_DB ?? 'app')
  console.log('Connected to MongoDB')
  return db
}

export function getDb(): Db {
  if (!db) throw new Error('DB not connected — call connectDb() first')
  return db
}

export async function closeDb() {
  await client?.close()
  client = null
  db = null
}