import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from 'prisma/generated/prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env['DATABASE_URL']!,
      }),
      log: ['warn', 'error', 'info', 'query'],
    })
  }
  onModuleInit() {
    return this.$connect()
  }
  onModuleDestroy() {
    return this.$disconnect()
  }
}
