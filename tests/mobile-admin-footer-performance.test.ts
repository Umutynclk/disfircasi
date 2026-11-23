import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'

describe('Görev 3 — Footer Dinamik Ürün Grupları', () => {
  const footerCode = fs.readFileSync(
    path.resolve(process.cwd(), 'components/layout/Footer.tsx'),
    'utf-8'
  )

  it('Statik eski 4 kategori bağlantısı (otomatik, kullan-at, yedek-firca-basliklari, travelSets) Footer içinden kaldırılmıştır', () => {
    assert.strictEqual(footerCode.includes('?kategori=otomatik'), false)
    assert.strictEqual(footerCode.includes('?kategori=kullan-at'), false)
    assert.strictEqual(footerCode.includes('?kategori=yedek-firca-basliklari'), false)
    assert.strictEqual(footerCode.includes('t.footer.travelSets'), false)
  })

  it('Ortak useCategories() ve buildCategoryUrl kullanır; kategori yoksa Ürün Grupları başlığını gizler', () => {
    assert.ok(footerCode.includes('useCategories()'))
    assert.ok(footerCode.includes('buildCategoryUrl'))
    assert.ok(footerCode.includes('activeCategories.length > 0'))
    assert.ok(footerCode.includes('showProductGroups &&'))
  })
})

describe('Görev 2 — Admin Paneli Mobil Uyumluluk', () => {
  it('app/admin/layout.tsx açılır/kapanır mobil drawer menü ve çakışmayan üst header içerir', () => {
    const layoutCode = fs.readFileSync(
      path.resolve(process.cwd(), 'app/admin/layout.tsx'),
      'utf-8'
    )
    assert.ok(layoutCode.includes('mobileMenuOpen'))
    assert.ok(layoutCode.includes('overflow-x-hidden'))
    assert.ok(layoutCode.includes('pt-14 lg:pt-0'))
  })

  it('components/admin/ProductList.tsx mobilde kart görünümü, masaüstünde tablo görünümü sunar', () => {
    const prodListCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/admin/ProductList.tsx'),
      'utf-8'
    )
    assert.ok(prodListCode.includes('md:hidden'))
    assert.ok(prodListCode.includes('hidden md:block'))
  })
})

describe('Görev 4 — Performans ve Aşamalı Yüklenme Animasyonu', () => {
  it('RevealOnScroll prefers-reduced-motion tercihine saygı gösterir ve IntersectionObserver kullanır', () => {
    const revealCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/common/RevealOnScroll.tsx'),
      'utf-8'
    )
    assert.ok(revealCode.includes('prefers-reduced-motion: reduce'))
    assert.ok(revealCode.includes('IntersectionObserver'))
  })

  it('app/page.tsx ekran altı bileşenleri dynamic() ile code-split eder ve SSR korur', () => {
    const pageCode = fs.readFileSync(path.resolve(process.cwd(), 'app/page.tsx'), 'utf-8')
    assert.ok(pageCode.includes("import dynamic from 'next/dynamic'"))
    assert.ok(pageCode.includes('RevealOnScroll'))
  })
})
