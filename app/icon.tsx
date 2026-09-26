import { ImageResponse } from 'next/og'
import { BrandMark } from './lib/brand-mark'

export function generateImageMetadata() {
  return [
    { id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' },
    { id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' },
  ]
}

export default function Icon({ id }: { id: string }) {
  return new ImageResponse(<BrandMark />, {
    width: Number(id),
    height: Number(id),
  })
}
