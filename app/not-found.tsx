'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { FiHome, FiShoppingBag, FiHelpCircle, FiArrowRight, FiSearch } from 'react-icons/fi'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center py-20 px-4 relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="max-w-2xl w-full mx-auto text-center relative z-10 space-y-8">
        
        {/* Animated Badge & Code */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            404 • Sayfa Bulunamadı
          </div>

          <div className="relative">
            <h1 className="text-8xl sm:text-9xl font-black tracking-tighter bg-gradient-to-b from-white via-slate-200 to-slate-600 bg-clip-text text-transparent select-none">
              404
            </h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl opacity-40">🦷</span>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Gülüşünüz Kaybolmasın, Buradayız!
          </h2>

          <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
            Aradığınız sayfa taşınmış, silinmiş veya geçici olarak kullanım dışı kalmış olabilir. Sizi doğru yere yönlendirelim.
          </p>
        </motion.div>

        {/* Primary Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-sky-500/25 hover:shadow-xl hover:scale-[1.02]"
          >
            <FiHome className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>

          <Link
            href="/urunler"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white rounded-2xl font-bold text-sm transition-all hover:scale-[1.02]"
          >
            <FiShoppingBag className="w-4 h-4 text-sky-400" />
            Ürünleri İncele
          </Link>
        </motion.div>

        {/* Popular Fast Links Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl text-left space-y-4 shadow-2xl"
        >
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <FiSearch className="w-3.5 h-3.5 text-sky-400" />
            Hızlı Yönlendirmeler:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <Link
              href="/urunler?kategori=otomatik"
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-sky-500/50 hover:bg-slate-800/40 transition-all flex items-center justify-between group"
            >
              <span className="font-semibold text-slate-300 group-hover:text-white">Otomatik Fırçalar</span>
              <FiArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              href="/urunler?kategori=kullan-at"
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-sky-500/50 hover:bg-slate-800/40 transition-all flex items-center justify-between group"
            >
              <span className="font-semibold text-slate-300 group-hover:text-white">Kullan-At Serisi</span>
              <FiArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              href="/iletisim"
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-sky-500/50 hover:bg-slate-800/40 transition-all flex items-center justify-between group"
            >
              <span className="font-semibold text-slate-300 group-hover:text-white">Canlı Destek</span>
              <FiHelpCircle className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-all" />
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
