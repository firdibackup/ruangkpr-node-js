import { brand } from './brand'
import { cn } from '@/lib/utils'

// A complete horizontal lockup, shared by the app shell and the brand editor.
export function BrandIdentity({ logo = brand.logo, compact = false, tagline = brand.tagline }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <img src={logo} alt={brand.name} width={1436} height={451} className={cn('object-contain object-left', compact ? 'h-8 w-[102px]' : 'h-10 w-[128px]')} />
      {tagline && <span className="text-[11px] font-semibold tracking-[0.4px] text-highlight">{tagline}</span>}
    </div>
  )
}
