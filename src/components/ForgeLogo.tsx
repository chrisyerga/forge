import { cn } from '@/lib/utils'

type ForgeLogoSize = 'xs' | 'sm' | 'md' | 'lg'

const markSizes: Record<ForgeLogoSize, string> = {
  xs: 'text-xl',
  sm: 'text-3xl',
  md: 'text-5xl',
  lg: 'text-7xl',
}

type ForgeLogoProps = {
  size?: ForgeLogoSize
  showWordmark?: boolean
  className?: string
}

export function ForgeLogoMark({ size = 'xs', className }: { size?: ForgeLogoSize; className?: string }) {
  return (
    <span
      className={cn(
        'font-["Orbitron"] font-black leading-none tracking-tighter',
        markSizes[size],
        'logo-dual-neon',
        className,
      )}
      aria-hidden
    >
      F
    </span>
  )
}

export function ForgeLogo({ size = 'xs', showWordmark = true, className }: ForgeLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <ForgeLogoMark size={size} />
      {showWordmark ? (
        <span className="text-sm font-semibold tracking-wide text-zinc-100">Forge</span>
      ) : null}
    </span>
  )
}
