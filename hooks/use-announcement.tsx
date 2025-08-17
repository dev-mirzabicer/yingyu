"use client"

import React, { useEffect, useRef } from "react"

/**
 * Hook for making announcements to screen readers via aria-live regions
 */
export function useAnnouncement() {
  const liveRegionRef = useRef<HTMLDivElement>(null)

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (liveRegionRef.current) {
      // Clear the region first to ensure the message is announced
      liveRegionRef.current.textContent = ''
      
      // Use a small delay to ensure the clearing is processed
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = message
          liveRegionRef.current.setAttribute('aria-live', priority)
        }
      }, 100)
    }
  }

  const LiveRegion = React.forwardRef<HTMLDivElement>((props, ref) => (
    <div
      ref={liveRegionRef}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      role="status"
      {...props}
    />
  ))

  return { announce, LiveRegion }
}