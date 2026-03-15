import 'dotenv/config'

import { execSync } from 'node:child_process'
import { PrismaPg } from '@prisma/adapter-pg'
import { Client } from 'pg'
import { PrismaClient } from 'prisma/generated/prisma/client'

function getMainDatabaseURL() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Please provider a DATABASE_URL environment variable')
  }

  return process.env.DATABASE_URL
}

function generateE2EDatabaseURL() {
  if (process.env.DATABASE_URL_E2E) {
    return process.env.DATABASE_URL_E2E
  }

  const url = new URL(getMainDatabaseURL())
  const dbName = url.pathname.replace(/^\//, '')

  url.pathname = `/${dbName}_e2e`
  url.searchParams.set('schema', 'public')

  return url.toString()
}

async function ensureDatabaseExists(databaseURL: string) {
  const databaseUrl = new URL(databaseURL)
  const databaseName = databaseUrl.pathname.replace(/^\//, '')

  if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
    throw new Error(`Invalid e2e database name: ${databaseName}`)
  }

  const adminURL = new URL(databaseURL)
  adminURL.pathname = '/postgres'
  adminURL.search = ''

  const client = new Client({
    connectionString: adminURL.toString(),
  })

  await client.connect()

  const databaseExists = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [databaseName],
  )

  if (databaseExists.rowCount === 0) {
    await client.query(`CREATE DATABASE "${databaseName}"`)
  }

  await client.end()
}

const databaseURL = generateE2EDatabaseURL()

process.env.DATABASE_URL = databaseURL

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseURL,
  }),
})

beforeAll(async () => {
  await ensureDatabaseExists(databaseURL)

  execSync('pnpm prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: databaseURL,
    },
  })
})

beforeEach(async () => {
  await prisma.question.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})
