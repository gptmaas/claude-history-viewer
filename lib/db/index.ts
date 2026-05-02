import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

type Database = ReturnType<typeof drizzle<typeof schema>>

let client: postgres.Sql | null = null
let db: Database | null = null

export function getDb(): Database {
  if (!db) {
    client = postgres(connectionString)
    db = drizzle(client, { schema })
  }
  return db
}

export async function closeDb() {
  if (client) {
    await client.end()
    client = null
    db = null
  }
}
