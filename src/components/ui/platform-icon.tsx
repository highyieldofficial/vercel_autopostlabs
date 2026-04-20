import { clsx } from 'clsx'

const ICONS: Record<string, { emoji: string; color: string; label: string }> = {
  facebook:  { emoji: 'f', color: 'bg-blue-600 text-white',   label: 'Facebook' },
  instagram: { emoji: '◈', color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white', label: 'Instagram' },
  twitter:   { emoji: '𝕏', color: 'bg-black text-white',      label: 'Twitter / X' },
  tiktok:    { emoji: '♪', color: 'bg-gray-900 text-white',   label: 'TikTok' },
  pinterest: { emoji: 'P', color: 'bg-red-600 text-white',    label: 'Pinterest' },
  linkedin:  { emoji: 'in', color: 'bg-blue-700 text-white',  label: 'LinkedIn' },
}

interface PlatformIconProps {
  platform: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const sizes = { xs: 'w-4 h-4 text-[9px]', sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' }

export function PlatformIcon({ platform, size = 'md', showLabel = false }: PlatformIconProps) {
  const cfg = ICONS[platform] ?? { emoji: '?', color: 'bg-gray-200 text-gray-600', label: platform }
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={clsx(
          'inline-flex items-center justify-center rounded-lg font-bold select-none',
          cfg.color,
          sizes[size]
        )}
        title={cfg.label}
      >
        {cfg.emoji}
      </span>
      {showLabel && <span className="text-sm text-gray-700">{cfg.label}</span>}
    </span>
  )
}
