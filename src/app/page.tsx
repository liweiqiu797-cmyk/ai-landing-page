'use client'
import { useMemo, useRef, useState } from 'react'
import { track, Events } from '@/lib/track'
import { getStyleList, type StyleId } from '@/lib/style-prompts'

type Step = 'idle' | 'ready' | 'generating' | 'done'

export default function Home() {
  const [step, setStep] = useState<Step>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [selectedStyleId, setSelectedStyleId] = useState<StyleId>('modern')
  const [stylePromptCursor, setStylePromptCursor] = useState<Record<string, number>>({})
  const [generationMeta, setGenerationMeta] = useState<{ styleName: string; promptIndex: number; isFloorPlan?: boolean } | null>(null)
  const [error, setError] = useState('')

  const [phone, setPhone] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const styles = useMemo(() => getStyleList(), [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setError('仅支持JPG/PNG格式，请重新选择照片')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setPreview(reader.result as string)
      setStep('ready')
      setResult(null)
    }
    reader.readAsDataURL(file)
    track(Events.PHOTO_UPLOAD, { file_size: file.size, source: 'album' })
  }

  async function runGenerate() {
    if (!preview) {
      setError('请先上传照片')
      return
    }

    setError('')
    setStep('generating')

    const currentCursor = stylePromptCursor[selectedStyleId] ?? 0

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: preview,
          styleId: selectedStyleId,
          promptIndex: currentCursor,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || '生成失败，请重试')
        setStep('ready')
        return
      }

      setResult(data.images?.[0] || null)
      setGenerationMeta({ styleName: data.styleName, promptIndex: data.promptIndex, isFloorPlan: data.isFloorPlan })
      setStylePromptCursor(prev => ({
        ...prev,
        [selectedStyleId]: typeof data.nextPromptIndex === 'number' ? data.nextPromptIndex : currentCursor + 1,
      }))
      setStep('done')

      track(Events.EFFECT_GENERATED, { style: data.styleName || selectedStyleId, prompt_index: data.promptIndex ?? -1 })
      track(Events.PROMPT_ROTATE, { style: selectedStyleId, next_cursor: data.nextPromptIndex ?? currentCursor + 1 })
    } catch {
      setError('网络错误，请稍后重试')
      setStep('ready')
    }
  }

  function pickStyle(id: StyleId) {
    setSelectedStyleId(id)
    const style = styles.find(s => s.id === id)
    track(Events.STYLE_SELECT, { style_id: id, style_name: style?.name || id })
    if (id === 'floorplan') track(Events.FLOORPLAN_SELECT, { enabled: true })
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/jpg" className="hidden" onChange={handleUpload} />

      {/* Hero */}
      <section className="px-4 pt-16 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-bold mb-4">8种风格任选，AI秒出装修方案</h1>
        <p className="text-gray-500 max-w-2xl mx-auto mb-6">
          上传你家照片，选择风格（含平面图方案），系统自动注入风格提示词并随机轮换，避免千篇一律。
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              track(Events.CTA_CLICK, { button_id: 'hero_upload', position: 'hero' })
              fileRef.current?.click()
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3 rounded-xl shadow transition"
          >
            📷 上传户型照片
          </button>
          <button
            onClick={runGenerate}
            disabled={!preview || step === 'generating'}
            className="border border-orange-500 text-orange-600 disabled:border-gray-300 disabled:text-gray-300 font-semibold px-7 py-3 rounded-xl transition"
          >
            {step === 'generating' ? '生成中...' : '立即生成效果图'}
          </button>
        </div>
      </section>

      {/* Style cards */}
      <section className="px-4 pb-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">选择装修风格（8选1）</h2>
            <p className="text-sm text-gray-500">每个风格内置10组提示词，自动轮换</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {styles.map(style => {
              const active = selectedStyleId === style.id
              return (
                <button
                  key={style.id}
                  onClick={() => pickStyle(style.id)}
                  className={`group text-left rounded-2xl overflow-hidden border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    active ? 'border-orange-500 ring-2 ring-orange-200 shadow-md' : 'border-gray-200'
                  }`}
                >
                  <div className="aspect-video bg-gray-100 relative">
                    <img src={style.cover} alt={style.name} className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition" />
                    {style.isFloorPlan && (
                      <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">平面图</span>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold">{style.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{style.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Preview compare */}
      <section className="px-4 pb-14">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-4">
            <h3 className="font-semibold mb-3">上传原图</h3>
            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
              {preview ? (
                <img src={preview} alt="原图" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-sm">请先上传JPG/PNG照片</span>
              )}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <h3 className="font-semibold mb-3">AI生成预览</h3>
            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center relative">
              {step === 'generating' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-white">
                  <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full mb-3" />
                  <p className="text-sm">正在生成，请稍候...</p>
                </div>
              )}
              {result ? (
                <img src={result} alt="效果图" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-sm">选择风格后点击“立即生成效果图”</span>
              )}
            </div>
            {generationMeta && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">当前风格：</span>{generationMeta.styleName}
                <span className="mx-2">|</span>
                <span>提示词组 #{generationMeta.promptIndex + 1}</span>
                {generationMeta.isFloorPlan && <span className="ml-2 text-blue-600">（平面图方案）</span>}
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-center text-red-500 text-sm mt-4">{error}</p>}
      </section>

      {/* Lead */}
      <section className="py-16 px-4 bg-orange-50">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">免费获取你家的专属设计方案</h2>
          <p className="text-gray-500 mb-6">留下手机号，设计师1对1为你定制完整方案</p>
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:outline-none"
            />
            <button
              disabled={phone.length !== 11}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold px-6 py-3 rounded-lg transition"
            >
              免费获取方案
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
