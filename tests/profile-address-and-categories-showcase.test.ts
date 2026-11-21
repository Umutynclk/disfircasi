import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  removeUndefined,
  getDistrictsForCity,
  validateAddressInput,
  buildCleanAddressRecord,
} from '../lib/utils/firestoreSanitize'
import {
  Category,
  buildCategoryUrl,
  getActiveCategories,
  getFeaturedShowcaseCategories,
  validateFeaturedCategoryInput,
} from '../lib/firebase/categories'

function hasUndefinedDeep(value: unknown): boolean {
  if (value === undefined) return true
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) {
    return value.some((item) => hasUndefinedDeep(item))
  }
  return Object.values(value as Record<string, unknown>).some((v) => hasUndefinedDeep(v))
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: `cat_${Math.random().toString(36).slice(2, 7)}`,
    name: 'Ağız Bakımı',
    slug: 'agiz-bakimi',
    description: 'Günlük ağız bakım ürünleri',
    order: 1,
    active: true,
    isFeatured: false,
    featuredOrder: 1,
    ...overrides,
  }
}

// ─── 1. PROFİL ADRES VE FIRESTORE SANITIZE TESTLERİ ─────────────────────────

describe('Firestore removeUndefined Yardımcı Fonksiyonu', () => {
  it('Nested nesne ve dizilerdeki tüm undefined değerleri temizler', () => {
    const input = {
      title: 'Ev',
      authorizedPerson: undefined,
      billingAddress: undefined,
      nested: {
        keep: 'ok',
        drop: undefined,
      },
      items: ['a', undefined, { x: 1, y: undefined }],
    }

    const cleaned = removeUndefined(input)
    assert.strictEqual(hasUndefinedDeep(cleaned), false)
    assert.strictEqual('authorizedPerson' in cleaned, false)
    assert.strictEqual('billingAddress' in cleaned, false)
    assert.strictEqual((cleaned.nested as any).keep, 'ok')
    assert.strictEqual('drop' in (cleaned.nested as any), false)
    assert.deepStrictEqual(cleaned.items, ['a', { x: 1 }])
  })

  it('Date, Timestamp, FieldValue ve GeoPoint benzeri Firestore nesnelerini bozmaz', () => {
    const date = new Date('2026-11-21T00:00:00Z')
    const fakeTimestamp = { seconds: 1700000000, nanoseconds: 0, toDate: () => date }
    const fakeFieldValue = { _methodName: 'serverTimestamp' }
    const fakeGeoPoint = { latitude: 41.0082, longitude: 28.9784 }

    const cleaned = removeUndefined({
      createdAt: date,
      ts: fakeTimestamp,
      fv: fakeFieldValue,
      geo: fakeGeoPoint,
      dropMe: undefined,
    })

    assert.strictEqual(cleaned.createdAt, date)
    assert.strictEqual(cleaned.ts, fakeTimestamp)
    assert.strictEqual(cleaned.fv, fakeFieldValue)
    assert.strictEqual(cleaned.geo, fakeGeoPoint)
    assert.strictEqual('dropMe' in cleaned, false)
  })
})

describe('Profil Adres — İl / İlçe Seçimi ve Doğrulama', () => {
  it('İl seçildiğinde yalnızca ilgili ilin benzersiz ilçelerini döndürür', () => {
    const istanbulDistricts = getDistrictsForCity('İstanbul')
    assert.ok(istanbulDistricts.includes('Kadıköy'))
    assert.ok(istanbulDistricts.includes('Beşiktaş'))
    assert.ok(!istanbulDistricts.includes('Çankaya'))

    // Ordu listesinde tekrar eden kayıt olmamalı
    const orduDistricts = getDistrictsForCity('Ordu')
    assert.strictEqual(orduDistricts.length, new Set(orduDistricts).size)
  })

  it('İl seçilmeden ilçe listesi boş döner', () => {
    assert.deepStrictEqual(getDistrictsForCity(''), [])
    assert.deepStrictEqual(getDistrictsForCity('   '), [])
  })

  it('İl değiştirildiğinde önceki ilçe yeni ilde yoksa geçersiz sayılır / temizlenmelidir', () => {
    const ankaraDistricts = getDistrictsForCity('Ankara')
    const prevDistrict = 'Kadıköy'
    assert.strictEqual(ankaraDistricts.includes(prevDistrict), false)
  })

  it('Zorunlu alanlar eksikse açıklayıcı doğrulama hatası döner', () => {
    assert.strictEqual(validateAddressInput({ title: '' }).valid, false)
    assert.strictEqual(
      validateAddressInput({ title: 'Ev', fullName: 'Ali Veli', phone: '05551112233', city: '', district: '', address: 'Test' }).field,
      'city'
    )
    assert.strictEqual(
      validateAddressInput({ title: 'Ev', fullName: 'Ali Veli', phone: '05551112233', city: 'İstanbul', district: '', address: 'Test' }).field,
      'district'
    )
    assert.strictEqual(
      validateAddressInput({ title: 'Ev', fullName: 'Ali Veli', phone: '05551112233', city: 'İstanbul', district: 'Kadıköy', address: '' }).field,
      'address'
    )
  })

  it('Yeni adres kaydı Firestore için hiç undefined içermez ve boş opsiyonel alanları çıkarır', () => {
    const record = buildCleanAddressRecord(
      {
        title: '  Ev Adresim  ',
        fullName: '  Umut Test ',
        phone: ' 05551234567 ',
        city: 'İstanbul',
        district: 'Kadıköy',
        neighborhood: '   ',
        postalCode: '',
        address: 'Caferağa Mah. Moda Cad. No:10',
        isCorporate: false,
        authorizedPerson: undefined,
        billingAddress: undefined,
      },
      {
        id: 'addr_1',
        isDefaultDelivery: true,
        isDefaultBilling: true,
        createdAt: '2026-11-21T10:00:00.000Z',
        updatedAt: '2026-11-21T10:00:00.000Z',
      }
    )

    assert.strictEqual(hasUndefinedDeep(record), false)
    assert.strictEqual(record.title, 'Ev Adresim')
    assert.strictEqual(record.city, 'İstanbul')
    assert.strictEqual(record.district, 'Kadıköy')
    assert.strictEqual('authorizedPerson' in record, false)
    assert.strictEqual('billingAddress' in record, false)
    assert.strictEqual('neighborhood' in record, false)
    assert.strictEqual('postalCode' in record, false)
  })

  it('Dolu opsiyonel alanlar (mahalle, posta kodu) korunur', () => {
    const record = buildCleanAddressRecord(
      {
        title: 'İş Adresim',
        fullName: 'Umut Test',
        phone: '05551234567',
        city: 'Ankara',
        district: 'Çankaya',
        neighborhood: 'Kızılay',
        postalCode: '06420',
        address: 'Atatürk Bulvarı No:5',
      },
      {
        id: 'addr_2',
        isDefaultDelivery: false,
        isDefaultBilling: false,
        createdAt: '2026-11-21T10:00:00.000Z',
        updatedAt: '2026-11-21T11:00:00.000Z',
      }
    )

    assert.strictEqual(record.neighborhood, 'Kızılay')
    assert.strictEqual(record.postalCode, '06420')
    assert.strictEqual(hasUndefinedDeep(record), false)
  })
})

// ─── 2. DİNAMİK KATEGORİ TESTLERİ ───────────────────────────────────────────

describe('Dinamik Kategori Sistemi — Ortak Veri Kaynağı ve URL', () => {
  it('Aktif kategorileri order sırasına göre döndürür, pasif olanları gizler', () => {
    const categories: Category[] = [
      makeCategory({ id: 'c3', name: 'Diş Macunları', slug: 'dis-macunlari', order: 3, active: true }),
      makeCategory({ id: 'c1', name: 'Ağız Bakımı', slug: 'agiz-bakimi', order: 1, active: true }),
      makeCategory({ id: 'c2', name: 'Pasif Kategori', slug: 'pasif', order: 2, active: false }),
    ]

    const active = getActiveCategories(categories)
    assert.strictEqual(active.length, 2)
    assert.deepStrictEqual(
      active.map((c) => c.id),
      ['c1', 'c3']
    )
  })

  it('Alt kategori parentId bilgisini korur', () => {
    const parent = makeCategory({ id: 'p1', name: 'Ağız Bakımı', slug: 'agiz-bakimi', order: 1 })
    const child = makeCategory({ id: 'ch1', name: 'Yedek Başlıklar', slug: 'yedek-basliklar', order: 2, parentId: 'p1' })

    const active = getActiveCategories([child, parent])
    assert.strictEqual(active[1].parentId, 'p1')
  })

  it('CTA / Kategori URL doğru query parametresi ve URL encoding ile üretilir', () => {
    assert.strictEqual(
      buildCategoryUrl({ id: '1', slug: 'dis-bakimi' }, '/tr/urunler'),
      '/tr/urunler?kategori=dis-bakimi'
    )
    assert.strictEqual(
      buildCategoryUrl({ id: '2', slug: 'ağız bakımı' }, '/tr/urunler'),
      '/tr/urunler?kategori=a%C4%9F%C4%B1z%20bak%C4%B1m%C4%B1'
    )
    assert.strictEqual(
      buildCategoryUrl({ id: 'cat_99', slug: '' }, '/urunler'),
      '/urunler?kategori=cat_99'
    )
  })
})

// ─── 3. ÇOKLU ANA SAYFA VİTRİN YÖNETİMİ TESTLERİ ───────────────────────────

describe('Çoklu Ana Sayfa Vitrin Yönetimi (0, 1, 2, 3, 4 ve 4+ Kategori)', () => {
  it('Hiç vitrinde kategori yoksa boş dizi döner', () => {
    const cats = [
      makeCategory({ id: '1', slug: 'a', isFeatured: false }),
      makeCategory({ id: '2', slug: 'b', isFeatured: false }),
    ]
    assert.strictEqual(getFeaturedShowcaseCategories(cats).length, 0)
  })

  it('1, 2, 3, 4 ve 6 vitrin kategorisini sınır koymadan döndürür', () => {
    for (const count of [1, 2, 3, 4, 6]) {
      const cats = Array.from({ length: count }, (_, idx) =>
        makeCategory({
          id: `cat_${idx + 1}`,
          name: `Kategori ${idx + 1}`,
          slug: `kategori-${idx + 1}`,
          order: idx + 1,
          active: true,
          isFeatured: true,
          featuredOrder: idx + 1,
          featured: {
            badge: 'ÖNE ÇIKAN',
            subtitle: `Koleksiyon ${idx + 1}`,
            title: `Başlık ${idx + 1}`,
            description: `Açıklama ${idx + 1}`,
            ctaLabel: 'Ürünleri Keşfet',
          },
        })
      )
      const featured = getFeaturedShowcaseCategories(cats)
      assert.strictEqual(featured.length, count, `${count} vitrin kategorisi eksiksiz dönmeli`)
    }
  })

  it('featuredOrder değiştiğinde ana sayfa vitrin sırası güncellenir', () => {
    const cats = [
      makeCategory({ id: 'c1', slug: 'a', isFeatured: true, featuredOrder: 3 }),
      makeCategory({ id: 'c2', slug: 'b', isFeatured: true, featuredOrder: 1 }),
      makeCategory({ id: 'c3', slug: 'c', isFeatured: true, featuredOrder: 2 }),
    ]
    const featured = getFeaturedShowcaseCategories(cats)
    assert.deepStrictEqual(
      featured.map((c) => c.id),
      ['c2', 'c3', 'c1']
    )
  })

  it('Pasif kategoriler veya vitrinden çıkarılan kategoriler vitrinde gösterilmez', () => {
    const cats = [
      makeCategory({ id: 'c1', slug: 'aktif-vitrin', active: true, isFeatured: true, featuredOrder: 1 }),
      makeCategory({ id: 'c2', slug: 'pasif-vitrin', active: false, isFeatured: true, featuredOrder: 2 }),
      makeCategory({ id: 'c3', slug: 'vitrinden-cikti', active: true, isFeatured: false, featuredOrder: 3 }),
    ]
    const featured = getFeaturedShowcaseCategories(cats)
    assert.deepStrictEqual(
      featured.map((c) => c.id),
      ['c1']
    )
  })

  it('Aynı kategori ID veya slug vitrinde birden fazla kez görünmez', () => {
    const cats = [
      makeCategory({ id: 'c1', slug: 'agiz-bakimi', active: true, isFeatured: true, featuredOrder: 1 }),
      makeCategory({ id: 'c1', slug: 'agiz-bakimi', active: true, isFeatured: true, featuredOrder: 2 }),
      makeCategory({ id: 'c2', slug: 'agiz-bakimi', active: true, isFeatured: true, featuredOrder: 3 }),
    ]
    const featured = getFeaturedShowcaseCategories(cats)
    assert.strictEqual(featured.length, 1)
  })

  it('Vitrin seçiliyken eksik zorunlu alanlar (title, ctaLabel) doğrulamadan geçmez', () => {
    const missingTitle = validateFeaturedCategoryInput({
      name: 'Diş Macunları',
      slug: 'dis-macunlari',
      isFeatured: true,
      featured: { title: '', ctaLabel: 'Keşfet' },
    })
    assert.strictEqual(missingTitle.valid, false)

    const missingCta = validateFeaturedCategoryInput({
      name: 'Diş Macunları',
      slug: 'dis-macunlari',
      isFeatured: true,
      featured: { title: 'Ferahlık', ctaLabel: '' },
    })
    assert.strictEqual(missingCta.valid, false)

    const validFeatured = validateFeaturedCategoryInput({
      name: 'Diş Macunları',
      slug: 'dis-macunlari',
      isFeatured: true,
      featured: {
        badge: 'ÖNE ÇIKAN',
        subtitle: 'Ağız Bakım Koleksiyonu',
        title: 'Gülümsemenize İyi Bakın',
        description: 'Günlük ağız bakım rutininiz için.',
        ctaLabel: 'Ürünleri Keşfet',
      },
    })
    assert.strictEqual(validFeatured.valid, true)
  })
})
