/**
 * Product 3D Pipeline
 * This file handles the transition between Mode 1 (Real 3D), Mode 2 (Image-to-3D service), and Mode 3 (2.5D Fallback).
 */

export interface DynamicProduct3D {
  id: string
  name: string
  images: string[]
  model3dUrl?: string
  price: number
  description?: string
  category?: string
}

export type RenderMode = 'mode1-real3d' | 'mode2-generated3d' | 'mode3-fallback25d'

export async function processProductFor3D(product: DynamicProduct3D): Promise<{ mode: RenderMode, assetUrl: string }> {
  // Mode 1: If it already has a 3D model
  if (product.model3dUrl && product.model3dUrl.trim() !== '') {
    return {
      mode: 'mode1-real3d',
      assetUrl: product.model3dUrl
    }
  }

  // Mode 2: Future Image-to-3D Pipeline connection goes here
  // Example: 
  // const generatedModel = await generateFromMeshy(product.images[0]);
  // if (generatedModel) return { mode: 'mode2-generated3d', assetUrl: generatedModel }

  // Mode 3: 2.5D Image Fallback
  return {
    mode: 'mode3-fallback25d',
    assetUrl: product.images && product.images.length > 0 ? product.images[0] : ''
  }
}
