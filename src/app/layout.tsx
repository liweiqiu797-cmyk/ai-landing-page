import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI装修效果图在线生成 - 拍照3秒出图，免费试用',
  description: '上传你家照片，AI智能生成装修效果图。支持现代简约、北欧、新中式等多种风格，3秒出图，完全免费。',
  keywords: 'AI装修效果图,装修效果图在线生成,AI设计,装修设计',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  )
}
