'use client'
import { useMemo, useRef, useState } from 'react'
import { track, Events } from '@/lib/track'
import { getStyleList, type StyleId } from '@/lib/style-prompts'

type Step = 'idle' | 'ready' | 'generating' | 'done'
type QuizAnswer = {
  householdSize: '1-2人' | '3-4人' | '5人以上' | ''
  preferredTone: '温暖奶油' | '现代极简' | '原木自然' | ''
  storageNeed: '低' | '中' | '高' | ''
}

export default function Home() {
  const [step, setStep] = useState<Step>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [selectedStyleId, setSelectedStyleId] = useState<StyleId>('modern')
  const [stylePromptCursor, setStylePromptCursor] = useState<Record<string, number>>({})
  const [generationMeta, setGenerationMeta] = useState<{ styleName: string; promptIndex: number; isFloorPlan?: boolean } | null>(null)
  const [error, setError] = useState('')

  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [need, setNeed] = useState('')
  const [elderlyNeed, setElderlyNeed] = useState('')
  const [healthConcern, setHealthConcern] = useState('')
  const [submitMsg, setSubmitMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [quiz, setQuiz] = useState<QuizAnswer>({
    householdSize: '',
    preferredTone: '',
    storageNeed: '',
  })
  const [quizStyleResult, setQuizStyleResult] = useState<StyleId | null>(null)

  const [budgetArea, setBudgetArea] = useState(80)
  const [budgetLevel, setBudgetLevel] = useState<'基础焕新' | '品质升级' | '高配全案'>('品质升级')
  const [budgetResult, setBudgetResult] = useState<{ min: number; max: number } | null>(null)

  const [comparePosition, setComparePosition] = useState(50)

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

  function resolveQuizStyle(answer: QuizAnswer): StyleId {
    if (answer.preferredTone === '现代极简') return 'modern'
    if (answer.preferredTone === '原木自然') return 'nordic'
    if (answer.preferredTone === '温暖奶油') return 'cream'
    return 'modern'
  }

  function runQuiz() {
    if (!quiz.householdSize || !quiz.preferredTone || !quiz.storageNeed) {
      setSubmitMsg('请先完成3个问题后再测评')
      return
    }

    const styleId = resolveQuizStyle(quiz)
    setQuizStyleResult(styleId)
    setSelectedStyleId(styleId)
    track(Events.STYLE_QUIZ_COMPLETE, {
      household_size: quiz.householdSize,
      preferred_tone: quiz.preferredTone,
      storage_need: quiz.storageNeed,
      result_style: styleId,
    })
  }

  function calcBudget() {
    const unitPriceMap: Record<typeof budgetLevel, [number, number]> = {
      基础焕新: [700, 1200],
      品质升级: [1300, 1800],
      高配全案: [1900, 2800],
    }

    const [minUnit, maxUnit] = unitPriceMap[budgetLevel]
    const min = budgetArea * minUnit
    const max = budgetArea * maxUnit
    setBudgetResult({ min, max })
    track(Events.BUDGET_CALCULATE, {
      area: budgetArea,
      budget_level: budgetLevel,
      min_budget: min,
      max_budget: max,
    })
  }

  async function submitLead() {
    setSubmitMsg('')

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setSubmitMsg('请输入正确手机号')
      return
    }

    setIsSubmitting(true)
    try {
      const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
      const payload = {
        phone,
        name,
        city,
        need,
        elderlyNeed,
        healthConcern,
        selectedStyleId,
        quizStyleResult,
        budgetArea,
        budgetLevel,
        source: query.get('utm_source') || 'direct',
        utm_medium: query.get('utm_medium') || '',
        utm_campaign: query.get('utm_campaign') || '',
      }

      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setSubmitMsg(data.error || '提交失败，请稍后重试')
        track(Events.LEAD_SUBMIT_FAIL, { reason: data.error || 'unknown' })
        return
      }

      setSubmitMsg('提交成功，顾问将尽快联系你')
      track(Events.LEAD_SUBMIT, {
        source: payload.source,
        style_id: selectedStyleId,
        has_budget: !!budgetResult,
        has_quiz: !!quizStyleResult,
      })
    } catch {
      setSubmitMsg('网络异常，请稍后重试')
      track(Events.LEAD_SUBMIT_FAIL, { reason: 'network' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const quizStyleName = quizStyleResult ? styles.find(s => s.id === quizStyleResult)?.name || quizStyleResult : ''

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/jpg" className="hidden" onChange={handleUpload} />

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

        {preview && result && (
          <div className="max-w-6xl mx-auto mt-6 bg-white border rounded-2xl p-4">
            <h3 className="font-semibold mb-3">前后对比素材组件</h3>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
              <img src={preview} alt="改造前" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}>
                <img src={result} alt="改造后" className="w-full h-full object-cover" />
              </div>
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">改造前</div>
              <div className="absolute top-2 right-2 bg-orange-600 text-white text-xs px-2 py-1 rounded">改造后</div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={comparePosition}
              onChange={e => setComparePosition(Number(e.target.value))}
              className="w-full mt-4"
            />
          </div>
        )}

        {error && <p className="text-center text-red-500 text-sm mt-4">{error}</p>}
      </section>

      <section className="px-4 pb-10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-5">
            <h3 className="text-xl font-bold mb-3">风格测试（30秒）</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-1">家庭人数</p>
                <select
                  value={quiz.householdSize}
                  onChange={e => setQuiz(prev => ({ ...prev, householdSize: e.target.value as QuizAnswer['householdSize'] }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">请选择</option>
                  <option>1-2人</option>
                  <option>3-4人</option>
                  <option>5人以上</option>
                </select>
              </div>

              <div>
                <p className="font-medium mb-1">偏好氛围</p>
                <select
                  value={quiz.preferredTone}
                  onChange={e => setQuiz(prev => ({ ...prev, preferredTone: e.target.value as QuizAnswer['preferredTone'] }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">请选择</option>
                  <option>温暖奶油</option>
                  <option>现代极简</option>
                  <option>原木自然</option>
                </select>
              </div>

              <div>
                <p className="font-medium mb-1">收纳需求</p>
                <select
                  value={quiz.storageNeed}
                  onChange={e => setQuiz(prev => ({ ...prev, storageNeed: e.target.value as QuizAnswer['storageNeed'] }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">请选择</option>
                  <option>低</option>
                  <option>中</option>
                  <option>高</option>
                </select>
              </div>

              <button onClick={runQuiz} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg">
                生成风格建议
              </button>

              {quizStyleResult && (
                <p className="text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  推荐风格：<span className="font-semibold">{quizStyleName}</span>（已自动切换）
                </p>
              )}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <h3 className="text-xl font-bold mb-3">预算测算（快速版）</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-1">建筑面积（㎡）</p>
                <input
                  type="number"
                  min={20}
                  max={500}
                  value={budgetArea}
                  onChange={e => setBudgetArea(Number(e.target.value) || 80)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <p className="font-medium mb-1">预算档位</p>
                <select
                  value={budgetLevel}
                  onChange={e => setBudgetLevel(e.target.value as typeof budgetLevel)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option>基础焕新</option>
                  <option>品质升级</option>
                  <option>高配全案</option>
                </select>
              </div>

              <button onClick={calcBudget} className="bg-gray-900 hover:bg-black text-white font-semibold px-4 py-2 rounded-lg">
                立即测算
              </button>

              {budgetResult && (
                <p className="text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  预估预算区间：<span className="font-semibold">¥{budgetResult.min.toLocaleString()} - ¥{budgetResult.max.toLocaleString()}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* AI设计商业化专题 */}
      <section className="px-4 py-12 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-2 text-center">AI设计商业化变现</h2>
          <p className="text-gray-500 text-center mb-8">用AI做装修方案，已经有人月入10万+</p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <div className="text-3xl mb-3">📸</div>
              <h3 className="font-bold text-lg mb-2">短视频获客</h3>
              <p className="text-sm text-gray-600">AI生成效果图做内容素材，单条视频引流50+精准线索，月均转化10+付费客户。</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-bold text-lg mb-2">私域变现</h3>
              <p className="text-sm text-gray-600">用AI效果图做"免费设计"钩子，引流到私域后转化全案设计服务，客单价3万+。</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="font-bold text-lg mb-2">招商加盟</h3>
              <p className="text-sm text-gray-600">展示AI设计效率优势，吸引传统装修公司加盟合作，单个加盟商收5-10万。</p>
            </div>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => track(Events.CTA_CLICK, { button_id: 'ai_business_learn_more', position: 'ai_business' })}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-3 rounded-xl transition"
            >
              了解更多变现模式
            </button>
          </div>
        </div>
      </section>

      {/* 2026家居CMF趋势 */}
      <section className="px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-2 text-center">2026家居CMF趋势</h2>
          <p className="text-gray-500 text-center mb-8">颜色 · 材质 · 工艺的最新方向</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded">颜色</span>
                <h3 className="font-bold text-lg">温暖奶油调</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">米白、奶咖、浅杏成为主流，柔和且有温度，适合客厅、卧室全屋通刷。</p>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-[#F5F0E6] text-xs rounded">#F5F0E6</span>
                <span className="px-3 py-1 bg-[#E8DCC8] text-xs rounded">#E8DCC8</span>
                <span className="px-3 py-1 bg-[#F0E6D8] text-xs rounded">#F0E6D8</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">材质</span>
                <h3 className="font-bold text-lg">自然质感</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">亚麻、藤编、实木占比提升，触感温润且环保，与奶油风、原木风完美搭配。</p>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-amber-50 text-xs rounded">亚麻</span>
                <span className="px-3 py-1 bg-amber-50 text-xs rounded">藤编</span>
                <span className="px-3 py-1 bg-amber-50 text-xs rounded">实木</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded">健康</span>
                <h3 className="font-bold text-lg">适老/健康需求</h3>
              </div>
              <p className="text-sm text-gray-600">无障碍扶手、防滑地面、净醛材料成为刚需，适老化改造政府有补贴。</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-1 rounded">智能</span>
                <h3 className="font-bold text-lg">轻智能升级</h3>
              </div>
              <p className="text-sm text-gray-600">智能灯光、窗帘电机、小爱同学入门套装，不用全屋重装也能体验智能化。</p>
            </div>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => track(Events.CTA_CLICK, { button_id: 'cmf_trend_more', position: 'cmf_trend' })}
              className="bg-gray-900 hover:bg-black text-white font-semibold px-8 py-3 rounded-xl transition"
            >
              获取CMF趋势报告
            </button>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-orange-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">咨询表单（已检查并增强校验）</h2>
          <p className="text-gray-500 mb-6">留下联系方式，顾问将基于风格测试和预算测算给你1对1方案</p>

          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              placeholder="姓名（选填）"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 20))}
              className="px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="城市（选填）"
              value={city}
              onChange={e => setCity(e.target.value.slice(0, 20))}
              className="px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-2 mb-2">
            <select
              value={elderlyNeed}
              onChange={e => setElderlyNeed(e.target.value)}
              className="px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:outline-none"
            >
              <option value="">是否有适老改造需求</option>
              <option value="是">是</option>
              <option value="否">否</option>
              <option value="待定">待定</option>
            </select>
            <select
              value={healthConcern}
              onChange={e => setHealthConcern(e.target.value)}
              className="px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:outline-none"
            >
              <option value="">健康关注点（选填）</option>
              <option value="空气">空气</option>
              <option value="光照">光照</option>
              <option value="噪音">噪音</option>
              <option value="其他">其他</option>
            </select>
          </div>

          <div className="grid md:grid-cols-[1fr,auto] gap-2 mb-2">
            <input
              type="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:outline-none"
            />
            <button
              onClick={submitLead}
              disabled={isSubmitting || phone.length !== 11}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold px-6 py-3 rounded-lg transition"
            >
              {isSubmitting ? '提交中...' : '免费获取方案'}
            </button>
          </div>

          <textarea
            placeholder="补充需求（选填）：如三房改四房、保留旧家具、工期要求等"
            value={need}
            onChange={e => setNeed(e.target.value.slice(0, 200))}
            className="w-full min-h-[88px] px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:outline-none"
          />

          {submitMsg && <p className="mt-3 text-sm text-gray-700">{submitMsg}</p>}
        </div>
      </section>
    </main>
  )
}
