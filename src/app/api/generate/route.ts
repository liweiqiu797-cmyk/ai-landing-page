import { NextRequest, NextResponse } from 'next/server'
import { submitImageTask, getTaskResult } from '@/lib/jimeng'
import { pickPrompt, STYLE_CONFIG, type StyleId } from '@/lib/style-prompts'

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, styleId = 'modern', promptIndex = 0 } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: '请上传照片' }, { status: 400 })

    // 校验风格
    if (!(styleId in STYLE_CONFIG)) {
      return NextResponse.json({ error: '无效风格，请重试' }, { status: 400 })
    }

    // 校验base64图片格式（仅支持jpeg/png）
    if (imageUrl.startsWith('data:')) {
      const mimeMatch = imageUrl.match(/^data:(image\/\w+);base64,/)
      if (!mimeMatch) return NextResponse.json({ error: '图片格式无效' }, { status: 400 })
      const mime = mimeMatch[1]
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(mime)) {
        return NextResponse.json({ error: '仅支持JPG/PNG格式，请重新选择照片' }, { status: 400 })
      }
    }

    const selected = pickPrompt(styleId as StyleId, Number(promptIndex) || 0)
    const fullPrompt = `保留原始空间结构和窗户位置，真实可落地家装效果，${selected.prompt}`

    const taskId = await submitImageTask(imageUrl, fullPrompt)

    // 轮询结果（最多60秒）
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const result = await getTaskResult(taskId)
      if (result.status === 'done' && result.images.length > 0) {
        return NextResponse.json({
          success: true,
          images: result.images,
          styleId,
          styleName: selected.styleName,
          promptIndex: selected.promptIndex,
          nextPromptIndex: selected.nextCursor,
          isFloorPlan: selected.isFloorPlan,
        })
      }
    }

    return NextResponse.json({ error: '生成超时，请重试' }, { status: 504 })
  } catch (err: any) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: err.message || '生成失败' }, { status: 500 })
  }
}
