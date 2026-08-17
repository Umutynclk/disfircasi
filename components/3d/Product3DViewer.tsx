'use client'

import { useRef, useState, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { FiImage, FiBox, FiInfo } from 'react-icons/fi'

interface Product3DViewerProps {
  model3dUrl?: string | null
  image?: string
  images?: string[]
  productName?: string
}

function RealGLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <group ref={groupRef} scale={[1.2, 1.2, 1.2]}>
      <primitive object={scene} />
    </group>
  )
}

export default function Product3DViewer({
  model3dUrl,
  image,
  images = [],
  productName,
}: Product3DViewerProps) {
  const allImages = images.length > 0 ? images : image ? [image] : []
  const [selectedImgIndex, setSelectedImgIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'image' | '3d'>(model3dUrl ? '3d' : 'image')

  const currentImage = allImages[selectedImgIndex] || image

  return (
    <div className="relative w-full h-[450px] md:h-[550px] bg-slate-50/90 rounded-[2.5rem] border border-slate-200/80 overflow-hidden flex flex-col justify-between p-6 group">
      {/* Top Bar: View Mode Switcher */}
      <div className="flex items-center justify-between z-20">
        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md p-1.5 rounded-full border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('image')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              viewMode === 'image'
                ? 'bg-brand-navy text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FiImage className="w-3.5 h-3.5" />
            <span>Fotoğraf</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              viewMode === '3d'
                ? 'bg-brand-blue text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FiBox className="w-3.5 h-3.5" />
            <span>3D Model</span>
            {model3dUrl && (
              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
            )}
          </button>
        </div>

        {model3dUrl ? (
          <span className="text-[11px] font-bold text-brand-blue bg-brand-softBlue px-3 py-1 rounded-full border border-brand-blue/20">
            360° Döndürülebilir Model
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-400 bg-white/80 px-3 py-1 rounded-full border border-slate-200/60">
            HD Ürün Galerisi
          </span>
        )}
      </div>

      {/* Main Center Display */}
      <div className="relative flex-1 flex items-center justify-center my-2 overflow-hidden">
        {viewMode === '3d' ? (
          model3dUrl ? (
            <div className="w-full h-full relative cursor-grab active:cursor-grabbing">
              <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ antialias: true, alpha: true }}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
                <directionalLight position={[-10, -10, -10]} intensity={0.5} color="#ffffff" />

                <Suspense
                  fallback={
                    <Float speed={2}>
                      <mesh>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color="#0878FF" wireframe />
                      </mesh>
                    </Float>
                  }
                >
                  <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.2}>
                    <RealGLBModel url={model3dUrl} />
                  </Float>
                </Suspense>

                <OrbitControls enableZoom={true} minDistance={2} maxDistance={8} autoRotate autoRotateSpeed={1.0} />
              </Canvas>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-slate-400 bg-white/80 backdrop-blur-xs px-3 py-1 rounded-full border border-slate-200/60 pointer-events-none">
                Döndürmek için sürükleyin
              </div>
            </div>
          ) : (
            <div className="text-center max-w-sm p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <FiInfo className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-brand-navy">3D Model Henüz Yüklenmemiştir</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Bu ürün için henüz resmi 3D geometri modeli eklenmemiştir. Temsili/sahte model gösterilmemektedir.
              </p>
              <button
                type="button"
                onClick={() => setViewMode('image')}
                className="px-4 py-2 bg-brand-navy text-white rounded-xl text-xs font-bold hover:bg-brand-blue transition-colors shadow-xs"
              >
                Fotoğraflara Göz At
              </button>
            </div>
          )
        ) : (
          <div className="w-full h-full p-4 flex items-center justify-center">
            {currentImage ? (
              <img
                src={currentImage}
                alt={productName || 'Ürün Görseli'}
                className="max-h-full max-w-full object-contain drop-shadow-xl group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="text-slate-400 text-sm font-medium">Fotoğraf Bulunamadı</div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Thumbnail Selector (if multiple images) */}
      {viewMode === 'image' && allImages.length > 1 && (
        <div className="flex items-center justify-center gap-2 z-20 pt-2 overflow-x-auto pb-1">
          {allImages.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedImgIndex(i)}
              className={`w-12 h-12 rounded-xl border-2 overflow-hidden bg-white transition-all flex-shrink-0 ${
                selectedImgIndex === i
                  ? 'border-brand-blue ring-2 ring-brand-blue/30 scale-105 shadow-sm'
                  : 'border-slate-200 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
