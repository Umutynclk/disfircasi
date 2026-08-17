/**
 * Animation Orchestrator & Math Utilities
 * Enforces single source of truth for scroll progress, camera transforms, 
 * mouse parallax, and tilt calculations across 3D and DOM layers.
 */

export interface MouseParallaxState {
  x: number
  y: number
  targetX: number
  targetY: number
}

// Lerp utility for ultra-smooth 60fps interpolation
export const lerp = (start: number, end: number, factor: number): number => {
  return start + (end - start) * factor
}

// Calculate 3D tilt angles based on mouse position within an element
export const calculateTilt = (
  mouseX: number,
  mouseY: number,
  rect: DOMRect,
  maxTiltDegrees: number = 5
) => {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  
  const normalizedX = (mouseX - centerX) / (rect.width / 2)
  const normalizedY = (mouseY - centerY) / (rect.height / 2)
  
  const tiltX = -normalizedY * maxTiltDegrees
  const tiltY = normalizedX * maxTiltDegrees
  
  return {
    tiltX: Math.max(-maxTiltDegrees, Math.min(maxTiltDegrees, tiltX)),
    tiltY: Math.max(-maxTiltDegrees, Math.min(maxTiltDegrees, tiltY)),
    normalizedX,
    normalizedY,
  }
}

// Standard easing curves for GSAP timelines
export const BRAND_EASINGS = {
  cinematic: 'power3.out',
  smoothReveal: 'power4.out',
  snappy: 'expo.out',
  bounceSoft: 'back.out(1.4)',
}
