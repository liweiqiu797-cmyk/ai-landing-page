import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'leads.json')

function readLeads(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {}
  return []
}

function writeLeads(leads: any[]) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2), 'utf-8')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      phone,
      name = '',
      city = '',
      need = '',
      elderlyNeed = '',
      healthConcern = '',
      source = 'landing-page',
      utm_medium = '',
      utm_campaign = '',
      selectedStyleId = '',
      quizStyleResult = '',
      budgetArea = 0,
      budgetLevel = '',
    } = body || {}

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 })
    }

    const leads = readLeads()

    if (leads.some((l: any) => l.phone === phone)) {
      return NextResponse.json({ success: true, message: '已提交' })
    }

    leads.push({
      phone,
      name,
      city,
      need,
      elderlyNeed,
      healthConcern,
      source,
      utm_medium,
      utm_campaign,
      selectedStyleId,
      quizStyleResult,
      budgetArea,
      budgetLevel,
      createdAt: new Date().toISOString(),
      referer: req.headers.get('referer') || '',
    })

    writeLeads(leads)

    return NextResponse.json({ success: true, message: '提交成功' })
  } catch (err: any) {
    console.error('Lead error:', err)
    return NextResponse.json({ error: '提交失败' }, { status: 500 })
  }
}
