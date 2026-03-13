import { ConflictException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateAccountController } from './create-account.controller'
import { PrismaService } from '@/prisma/prisma.service'

const makePrismaService = () => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
})

describe('CreateAccountController', () => {
  let controller: CreateAccountController
  let prisma: ReturnType<typeof makePrismaService>

  beforeEach(async () => {
    prisma = makePrismaService()

    const module = await Test.createTestingModule({
      controllers: [CreateAccountController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile()

    controller = module.get(CreateAccountController)
  })

  it('should create an account successfully', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({})

    await expect(
      controller.handle({
        name: 'John Doe',
        email: 'john@example.com',
        password: '123456',
      }),
    ).resolves.toBeUndefined()

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'john@example.com' },
    })
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
        }),
      }),
    )
  })

  it('should hash the password before saving', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({})

    await controller.handle({
      name: 'John Doe',
      email: 'john@example.com',
      password: '123456',
    })

    const createCall = prisma.user.create.mock.calls[0][0]
    expect(createCall.data.password).not.toBe('123456')
    expect(createCall.data.password).toMatch(/^\$2[ab]\$/)
  })

  it('should throw ConflictException when email is already in use', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'john@example.com',
    })

    await expect(
      controller.handle({
        name: 'John Doe',
        email: 'john@example.com',
        password: '123456',
      }),
    ).rejects.toThrow(ConflictException)

    expect(prisma.user.create).not.toHaveBeenCalled()
  })
})
