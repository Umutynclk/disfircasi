'use client'

import { useRef, useState, ReactNode, MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { calculateTilt } from '@/lib/animation/orchestrator'

interface TiltCardProps {
  children: ReactNode
  className?: string
  maxTilt?: number
  scaleOnHover?: number
  glowColor?: 'blue' | 'green' | 'cyan' | 'none'
  onClick?: () => void
}

export default function TiltCard({
  children,
  className = '',
  maxTilt = 5,
  scaleOnHover = 1.03,
  glowColor = 'blue',
  onClick,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const { tiltX, tiltY } = calculateTilt(e.clientX, e.clientY, rect, maxTilt)
    setTransform({ rotateX: tiltX, rotateY: tiltY })
  }

  const handleMouseEnter = () => setIsHovered(true)

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTransform({ rotateX: 0, rotateY: 0 })
  }

  const glowClasses = {
    blue: 'hover:shadow-[0_20px_50px_rgba(8,120,255,0.25)]',
    green: 'hover:shadow-[0_20px_50px_rgba(19,184,58,0.25)]',
    cyan: 'hover:shadow-[0_20px_50px_rgba(0,210,255,0.25)]',
    none: '',
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      animate={{
        rotateX: transform.rotateX,
        rotateY: transform.rotateY,
        scale: isHovered ? scaleOnHover : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
      style={{ transformStyle: 'preserve-3d' }}
      className={`perspective-1000 cursor-pointer transition-shadow duration-500 ease-out ${glowClasses[glowColor]} ${className}`}
    >
      {children}
    </motion.div>
  )
}
