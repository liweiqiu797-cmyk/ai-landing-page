import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const LOG_FILE = path.join(process.cwd(), 'track-events.jsonl')

export async function POST(req: NextRequest) {
  try {
    const event = await req.json()
    const line = JSON.stringify(event) + '\n'
    fs.appendFileSync(LOG_FILE, line, 'utf-8')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
