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

  // 异步发送，不阻塞UI
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

// 埋点事件
export const Events = {
  PAGE_VIEW: 'page_view',
  CTA_CLICK: 'cta_click',
  PHOTO_UPLOAD: 'photo_upload',
  EFFECT_GENERATED: 'effect_generated',
  STYLE_CLICK: 'style_click',
  STYLE_SELECT: 'style_select',
  PROMPT_ROTATE: 'prompt_rotate',
  FLOORPLAN_SELECT: 'floorplan_select',
  LEAD_POPUP_SHOW: 'lead_popup_show',
  LEAD_SUBMIT: 'lead_submit',
} as const
