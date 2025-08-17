"use client"

import { useState, useEffect } from "react"

/**
 * Hook for responsive design and mobile detection
 */
export function useResponsiveDesign() {
  const [isMobile, setIsMobile] = useState(false)
  const [screenSize, setScreenSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md')
  const [preferesReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isHighContrast, setIsHighContrast] = useState(false)

  useEffect(() => {
    const checkResponsive = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      
      if (width < 640) {
        setScreenSize('sm')
      } else if (width < 768) {
        setScreenSize('md')
      } else if (width < 1024) {
        setScreenSize('lg')
      } else {
        setScreenSize('xl')
      }
    }

    const checkAccessibilityPreferences = () => {
      // Check for reduced motion preference
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      setPrefersReducedMotion(reducedMotionQuery.matches)

      // Check for high contrast preference
      const highContrastQuery = window.matchMedia('(prefers-contrast: high)')
      setIsHighContrast(highContrastQuery.matches)

      // Listen for changes
      reducedMotionQuery.addEventListener('change', (e) => setPrefersReducedMotion(e.matches))
      highContrastQuery.addEventListener('change', (e) => setIsHighContrast(e.matches))
    }

    // Initial checks
    checkResponsive()
    checkAccessibilityPreferences()

    // Listen for resize events
    window.addEventListener('resize', checkResponsive)

    return () => {
      window.removeEventListener('resize', checkResponsive)
    }
  }, [])

  return {
    isMobile,
    screenSize,
    preferesReducedMotion,
    isHighContrast,
    // Helper functions
    getTouchTargetSize: () => isMobile ? 'h-14' : 'h-12',
    getTextSize: (base: string) => isMobile ? `${base} md:text-lg` : base,
    getSpacing: (base: string) => isMobile ? `${base} p-4` : base,
  }
}