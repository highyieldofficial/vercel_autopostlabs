import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, {
  max: 1,            // one connection per serverless function instance
  connect_timeout: 10,  // fail in 10s instead of hanging forever
  idle_timeout: 20,     // release idle connections after 20s
  // pgbouncer (Supabase pooler port 6543) requires prepare:false
  prepare: !process.env.DATABASE_URL?.includes('pgbouncer'),
})

export const db = drizzle(client, { schema })

export * from './schema'
