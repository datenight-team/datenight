import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  await prisma.$queryRaw`SELECT 1`
  return NextResponse.json({ status: 'ok' })
}
