'use client'
import { useState, useRef, useEffect } from 'react'
import { track, Events } from '@/lib/track'

const STYLES = [
  { id: 'modern', name: '现代简约', locked: false },
  { id: 'nordic', name: '北欧', locked: true },
  { id: 'chinese', name: '新中式', locked: true },
  { id: 'luxury', name: '轻奢', locked: true },
]

export default function Home() {
  const [step, setStep] = useState<'idle' | 'uploading' | 'generating' | 'done'>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [results, setResults] = useState<string[]>([])
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [phone, setPhone] = useState('')
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const leadRef = useRef<HTMLDivElement>(null)

  useEffect(() => { track(Events.PAGE_VIEW) }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setStep('uploading')

    // 预览
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    // 上传到临时存储（MVP用base64直传，后续改OSS）
    setStep('generating')
    track(Events.PHOTO_UPLOAD, { file_size: file.size, source: 'album' })
    try {
      // MVP: 用base64作为imageUrl传给后端
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: base64, style: '现代简约' }),
      })
      const data = await res.json()
      if (data.success) {
        setResults(data.images)
        setStep('done')
        track(Events.EFFECT_GENERATED, { style: '现代简约', duration: 0 })
      } else {
        setError(data.error || '生成失败')
        setStep('idle')
      }
    } catch {
      setError('网络错误，请重试')
      setStep('idle')
    }
  }

  async function handleLeadSubmit() {
    if (!/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的手机号'); return }
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (data.success) {
        setLeadSubmitted(true)
        setShowLeadModal(false)
        track(Events.LEAD_SUBMIT, { trigger_type: showLeadModal ? 'popup' : 'bottom_form' })
      } else {
        setError(data.error || '提交失败')
      }
    } catch {
      setError('网络错误')
    }
  }

  return (
    <main className="min-h-screen">
      {/* 模块1: Hero区 */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-orange-50 to-white">
        <h1 className="text-3xl md:text-5xl font-bold text-center mb-4">
          拍张照，AI 3秒出装修效果图
        </h1>
        <p className="text-gray-500 text-center mb-8 max-w-md">
          不用等设计师，不用花钱，上传你家照片立刻看效果
        </p>

        {step === 'idle' && (
          <>
            <button
              onClick={() => { track(Events.CTA_CLICK, { button_id: 'hero_cta', position: 'hero' }); fileRef.current?.click() }}
              className="bg-orange-500 hover:bg-orange-600 text-white text-lg font-semibold px-8 py-4 rounded-xl shadow-lg transition w-full max-w-sm"
            >
              📷 免费生成我的效果图
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <p className="text-xs text-gray-400 mt-3">完全免费 · 无需注册 · 支持全部户型</p>
          </>
        )}

        {step === 'uploading' && <p className="text-gray-500">正在上传照片...</p>}

        {step === 'generating' && (
          <div className="text-center">
            <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600 font-medium">AI正在分析你的空间...</p>
            <div className="mt-4 space-y-2 text-sm text-gray-400">
              <p>✓ 识别空间布局</p>
              <p>✓ 匹配装修风格</p>
              <p className="animate-pulse">⏳ 生成效果图中...</p>
            </div>
          </div>
        )}

        {step === 'done' && results.length > 0 && (
          <div className="w-full max-w-2xl">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {preview && <img src={preview} alt="原图" className="rounded-lg w-full aspect-video object-cover" />}
              <img src={results[0]} alt="效果图" className="rounded-lg w-full aspect-video object-cover" />
            </div>
            <div className="flex gap-2 mb-4">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    track(Events.STYLE_CLICK, { style_name: s.name, is_locked: s.locked && !leadSubmitted })
                    if (s.locked && !leadSubmitted) { track(Events.LEAD_POPUP_SHOW, { trigger_type: 'style_click' }); setShowLeadModal(true) }
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                    s.locked && !leadSubmitted
                      ? 'border-gray-200 text-gray-400 bg-gray-50'
                      : 'border-orange-500 text-orange-600 bg-orange-50'
                  }`}
                >
                  {s.locked && !leadSubmitted ? '🔒 ' : ''}{s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </section>

      {/* 模块2: 效果展示区 */}
      <section className="py-16 px-4 bg-gray-50">
        <h2 className="text-2xl font-bold text-center mb-8">看看别人家的变化</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { style: '现代简约', room: '客厅', img: '/case-modern-living.webp' },
            { style: '新中式', room: '客厅', img: null },
            { style: '轻奢', room: '餐厅', img: null },
            { style: '北欧', room: '卧室', img: null },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
              {item.img ? (
                <img src={item.img} alt={`${item.style}${item.room}`} className="aspect-video object-cover w-full" />
              ) : (
                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 text-sm">
                  {item.style} · {item.room} 效果图
                </div>
              )}
              <div className="p-3 flex justify-between items-center">
                <span className="text-sm font-medium">{item.style} · {item.room}</span>
                <span className="text-xs text-gray-400">由AI根据实拍照片生成</span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <button
            onClick={() => fileRef.current?.click()}
            className="text-orange-500 font-medium hover:underline"
          >
            我也试试 →
          </button>
        </div>
      </section>

      {/* 模块3: 三步流程区 */}
      <section className="py-16 px-4">
        <h2 className="text-2xl font-bold text-center mb-10">简单三步，立刻看效果</h2>
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { icon: '📱', title: '拍一张照片', desc: '上传你家任意房间' },
            { icon: '🤖', title: 'AI 3秒生成', desc: '智能识别空间布局' },
            { icon: '🎨', title: '选你喜欢的风格', desc: '多种风格随心切换' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-4xl mb-3">{s.icon}</div>
              <h3 className="font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 模块4: 信任背书区 */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { num: '10万+', label: '训练图片' },
            { num: '8+', label: '主流风格' },
            { num: '3秒', label: '极速生成' },
            { num: '10年+', label: '家装经验' },
          ].map((item, i) => (
            <div key={i}>
              <div className="text-2xl font-bold text-orange-500">{item.num}</div>
              <div className="text-sm text-gray-500 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">效果图由AI生成，仅供装修参考</p>
      </section>

      {/* 模块5: 留资转化区 */}
      <section ref={leadRef} className="py-16 px-4 bg-orange-50">
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
              onClick={handleLeadSubmit}
              disabled={phone.length !== 11}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold px-6 py-3 rounded-lg transition"
            >
              免费获取方案
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">🔒 信息严格保密，仅用于设计服务</p>
        </div>
      </section>

      {/* 模块6: 页脚 */}
      <footer className="py-6 px-4 text-center text-xs text-gray-400 border-t">
        <p>© 2026 研屋设计 · 粤ICP备XXXXXXXX号</p>
        <p className="mt-1">
          <a href="#" className="hover:underline">隐私政策</a> · <a href="#" className="hover:underline">用户协议</a>
        </p>
      </footer>

      {/* 留资弹窗 */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative">
            <button onClick={() => setShowLeadModal(false)} className="absolute top-3 right-3 text-gray-400 text-xl">×</button>
            <h3 className="text-lg font-bold mb-2">解锁全部风格，免费获取完整方案</h3>
            <div className="flex gap-2 mt-4">
              <input
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:outline-none"
              />
              <button
                onClick={handleLeadSubmit}
                disabled={phone.length !== 11}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold px-4 py-3 rounded-lg transition"
              >
                立即解锁
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">完全免费 · 信息严格保密</p>
          </div>
        </div>
      )}

      {/* 移动端吸底栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 md:hidden z-40">
        <div className="flex gap-2 max-w-md mx-auto">
          <input
            type="tel"
            placeholder="手机号"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
          />
          <button
            onClick={handleLeadSubmit}
            disabled={phone.length !== 11}
            className="bg-orange-500 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            免费获取方案
          </button>
        </div>
      </div>
    </main>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
