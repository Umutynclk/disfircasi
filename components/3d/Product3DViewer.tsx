'use client'

/**
 * KALIPORT / SONRAKAM.COM - Product3DViewer (Deprecated / Replaced with high performance photo gallery)
 * 3D model gereksinimi kaldırılmış olup ürün fotoğrafları standart optimize galeride sunulmaktadır.
 */

interface Product3DViewerProps {
  image?: string
  images?: string[]
  productName?: string
}

export default function Product3DViewer({
  image,
  images = [],
  productName,
}: Product3DViewerProps) {
  const displayImage = images[0] || image

  return (
    <div className="relative w-full aspect-square bg-slate-50 rounded-[2rem] border border-slate-200/80 overflow-hidden flex items-center justify-center p-6">
      {displayImage ? (
        <img
          src={displayImage}
          alt={productName || 'Ürün Görseli'}
          className="w-full h-full object-contain"
        />
      ) : (
        <span className="text-slate-400 text-sm">Görsel bulunamadı</span>
      )}
    </div>
  )
}
