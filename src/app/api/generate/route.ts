import { NextRequest, NextResponse } from 'next/server'
import { submitImageTask, getTaskResult } from '@/lib/jimeng'

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, style = '现代简约' } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: '请上传照片' }, { status: 400 })

    // 校验base64图片格式（仅支持jpeg/png）
    if (imageUrl.startsWith('data:')) {
      const mimeMatch = imageUrl.match(/^data:(image\/\w+);base64,/)
      if (!mimeMatch) return NextResponse.json({ error: '图片格式无效' }, { status: 400 })
      const mime = mimeMatch[1]
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(mime)) {
        return NextResponse.json({ error: '仅支持JPG/PNG格式，请重新选择照片' }, { status: 400 })
      }
    }

    const prompt = '保留原始空间布局和窗户位置不变，更换墙面材质，更换地面材质，家具更换为对应风格，整体色调协调，落地窗自然光充足，wide-angle, photorealistic, 8K'
    const taskId = await submitImageTask(imageUrl, prompt, style)

    // 轮询结果（最多60秒）
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const result = await getTaskResult(taskId)
      if (result.status === 'done' && result.images.length > 0) {
        return NextResponse.json({ success: true, images: result.images, style })
      }
    }

    return NextResponse.json({ error: '生成超时，请重试' }, { status: 504 })
  } catch (err: any) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: err.message || '生成失败' }, { status: 500 })
  }
}
