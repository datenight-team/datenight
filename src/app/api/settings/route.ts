// src/app/api/settings/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ALL_DB_KEYS } from '@/lib/config'

export async function GET() {
  const rows = await prisma.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const result = Object.fromEntries(ALL_DB_KEYS.map((k) => [k, map[k] ?? '']))
  return NextResponse.json(result)
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates = Object.entries(body).filter(
    ([k, v]) => ALL_DB_KEYS.includes(k) && typeof v === 'string'
  ) as [string, string][]

  await Promise.all(
    updates.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
