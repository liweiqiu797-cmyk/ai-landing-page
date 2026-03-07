// 埋点工具 - MVP用自建轻量方案，后续可切友盟/神策
// 事件发送到 /api/track（本地存储）或直接console.log（开发阶段）

type TrackEvent = {
  event: string
  params?: Record<string, string | number | boolean>
  timestamp?: string
}

const IS_DEV = process.env.NODE_ENV === 'development'

export function track(event: string, params: Record<string, string | number | boolean> = {}) {
  const payload: TrackEvent = {
    event,
    params: {
      ...params,
      url: typeof window !== 'undefined' ? window.location.href : '',
      device: typeof window !== 'undefined' ? (window.innerWidth < 768 ? 'mobile' : 'desktop') : '',
      source: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('utm_source') || 'direct' : '',
    },
    timestamp: new Date().toISOString(),
  }

  if (IS_DEV) {
    console.log('[Track]', payload.event, payload.params)
  }

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', JSON.stringify(payload))
  } else {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  }
}

export const Events = {
  PAGE_VIEW: 'page_view',
  CTA_CLICK: 'cta_click',
  PHOTO_UPLOAD: 'photo_upload',
  EFFECT_GENERATED: 'effect_generated',
  STYLE_SELECT: 'style_select',
  PROMPT_ROTATE: 'prompt_rotate',
  FLOORPLAN_SELECT: 'floorplan_select',
  STYLE_QUIZ_COMPLETE: 'style_quiz_complete',
  BUDGET_CALCULATE: 'budget_calculate',
  LEAD_POPUP_SHOW: 'lead_popup_show',
  LEAD_SUBMIT: 'lead_submit',
  LEAD_SUBMIT_FAIL: 'lead_submit_fail',
  CMF_TREND_CLICK: 'cmf_trend_click',
  CMF_COLOR_CLICK: 'cmf_color_click',
  CMF_MATERIAL_CLICK: 'cmf_material_click',
  CMF_HEALTH_CLICK: 'cmf_health_click',
  CMF_SMART_CLICK: 'cmf_smart_click',
  AI_BUSINESS_CLICK: 'ai_business_click',
} as const
