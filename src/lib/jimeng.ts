import crypto from 'crypto'

const AK = process.env.VOLC_ACCESS_KEY!
const SK = process.env.VOLC_SECRET_KEY!
const HOST = 'visual.volcengineapi.com'

function hmacSHA256(key: Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest()
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function getSignatureKey(sk: string, date: string, region: string, service: string): Buffer {
  const kDate = hmacSHA256(Buffer.from(sk, 'utf-8'), date)
  const kRegion = hmacSHA256(kDate, region)
  const kService = hmacSHA256(kRegion, service)
  return hmacSHA256(kService, 'request')
}

function signRequest(method: string, action: string, body: string): Record<string, string> {
  const now = new Date()
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const region = 'cn-north-1'
  const service = 'cv'
  const credentialScope = `${dateStamp}/${region}/${service}/request`
  const queryString = `Action=${action}&Version=2022-08-31`
  const payloadHash = sha256(body)

  const canonicalHeaders = `content-type:application/json\nhost:${HOST}\nx-date:${amzDate}\n`
  const signedHeaders = 'content-type;host;x-date'
  const canonicalRequest = `${method}\n/\n${queryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const stringToSign = `HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`
  const signingKey = getSignatureKey(SK, dateStamp, region, service)
  const signature = hmacSHA256(signingKey, stringToSign).toString('hex')

  return {
    'Content-Type': 'application/json',
    'Host': HOST,
    'X-Date': amzDate,
    'Authorization': `HMAC-SHA256 Credential=${AK}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

// 提交图生图任务
export async function submitImageTask(imageUrl: string, prompt: string, style: string): Promise<string> {
  const fullPrompt = `Interior redesign, transform to ${style} style, ${prompt}`
  const body = JSON.stringify({
    req_key: 'jimeng_i2i_v30',
    image_urls: [imageUrl],
    prompt: fullPrompt,
    scale: 0.5,
    width: 1472,
    height: 1104,
  })

  const headers = signRequest('POST', 'CVSync2AsyncSubmitTask', body)
  const res = await fetch(`https://${HOST}/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31`, {
    method: 'POST',
    headers,
    body,
  })
  const data = await res.json()
  if (data.code !== 10000) throw new Error(data.message || 'Submit task failed')
  return data.data.task_id
}

// 查询任务结果
export async function getTaskResult(taskId: string): Promise<{ status: string; images: string[] }> {
  const body = JSON.stringify({
    req_key: 'jimeng_i2i_v30',
    task_id: taskId,
    req_json: '{"return_url":true}',
  })

  const headers = signRequest('POST', 'CVSync2AsyncGetResult', body)
  const res = await fetch(`https://${HOST}/?Action=CVSync2AsyncGetResult&Version=2022-08-31`, {
    method: 'POST',
    headers,
    body,
  })
  const data = await res.json()
  if (data.code !== 10000) throw new Error(data.message || 'Get result failed')

  return {
    status: data.data.status ?? 'generating',
    images: data.data.image_urls ?? [],
  }
}

// 文生图（无参考图时用）
export async function submitTextToImage(prompt: string): Promise<string> {
  const body = JSON.stringify({
    req_key: 'jimeng_i2i_v30',
    prompt,
    width: 1472,
    height: 1104,
  })

  const headers = signRequest('POST', 'CVSync2AsyncSubmitTask', body)
  const res = await fetch(`https://${HOST}/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31`, {
    method: 'POST',
    headers,
    body,
  })
  const data = await res.json()
  if (data.code !== 10000) throw new Error(data.message || 'Submit task failed')
  return data.data.task_id
}
