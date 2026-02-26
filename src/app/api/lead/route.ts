import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// MVP阶段：留资数据存本地JSON文件，后续切数据库
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
    const { phone, source = 'landing-page' } = await req.json()

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 })
    }

    // TODO: 短信验证码校验（等阿里云账号到位后对接）

    const leads = readLeads()

    // 防重复
    if (leads.some((l: any) => l.phone === phone)) {
      return NextResponse.json({ success: true, message: '已提交' })
    }

    leads.push({
      phone,
      source,
      createdAt: new Date().toISOString(),
      utm: req.headers.get('referer') || '',
    })
    writeLeads(leads)

    return NextResponse.json({ success: true, message: '提交成功' })
  } catch (err: any) {
    console.error('Lead error:', err)
    return NextResponse.json({ error: '提交失败' }, { status: 500 })
  }
}
