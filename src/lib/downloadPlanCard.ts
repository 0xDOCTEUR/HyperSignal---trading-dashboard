import html2canvas from 'html2canvas'

/** Renders a DOM subtree to a PNG file download (plan card snapshot). */
export async function downloadElementAsPng(el: HTMLElement, filename: string): Promise<void> {
  const bg =
    typeof getComputedStyle !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#111827'
      : '#111827'

  const canvas = await html2canvas(el, {
    scale: Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 2),
    useCORS: true,
    allowTaint: true,
    backgroundColor: bg || '#111827',
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
  })

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('toBlob failed'))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename.endsWith('.png') ? filename : `${filename}.png`
      a.rel = 'noopener'
      a.click()
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}
