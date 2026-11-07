import { MetadataRoute } from 'next'
import { getAdminFirestore } from '@/lib/firebase/admin'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sonrakam.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString()

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/urunler`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/hakkimizda`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/iletisim`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sss`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/kargo`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/iptal`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/gizlilik-ve-guvenlik`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/kvkk`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/mesafeli-satis-sozlesmesi`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/on-bilgilendirme-formu`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  try {
    const db = getAdminFirestore()
    const snapshot = await db.collection('products').get()
    const productPages: MetadataRoute.Sitemap = snapshot.docs
      .filter((doc) => doc.exists && doc.data()?.inStock !== false)
      .map((doc) => {
        const data = doc.data()
        return {
          url: `${BASE_URL}/urunler/${doc.id}`,
          lastModified: data?.updatedAt || now,
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }
      })

    return [...staticPages, ...productPages]
  } catch (error) {
    console.warn('Sitemap dynamic products fetch warning (using static pages fallback):', error)
    return staticPages
  }
}
