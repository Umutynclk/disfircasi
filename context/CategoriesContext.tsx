'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  Category,
  subscribeToCategories,
  getActiveCategories,
  getFeaturedShowcaseCategories,
} from '@/lib/firebase/categories'

interface CategoriesContextType {
  categories: Category[]
  activeCategories: Category[]
  featuredCategories: Category[]
  loading: boolean
}

const CategoriesContext = createContext<CategoriesContextType>({
  categories: [],
  activeCategories: [],
  featuredCategories: [],
  loading: true,
})

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | undefined
    try {
      unsub = subscribeToCategories((cats) => {
        setCategories(cats)
        setLoading(false)
      })
    } catch (err) {
      console.error('CategoriesProvider init error:', err)
      setLoading(false)
    }
    return () => {
      if (unsub) unsub()
    }
  }, [])

  const activeCategories = useMemo(() => getActiveCategories(categories), [categories])
  const featuredCategories = useMemo(() => getFeaturedShowcaseCategories(categories), [categories])

  const value = useMemo(
    () => ({
      categories,
      activeCategories,
      featuredCategories,
      loading,
    }),
    [categories, activeCategories, featuredCategories, loading]
  )

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>
}

export function useCategories(): CategoriesContextType {
  return useContext(CategoriesContext)
}
