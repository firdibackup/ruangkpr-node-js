import { Link } from 'react-router-dom'
import { SearchXIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/ui'

export function NotFoundPage({ to = '/', label = 'Kembali ke Home' }) {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Halaman tidak ditemukan"
      action={
        <Button asChild size="md">
          <Link to={to}>{label}</Link>
        </Button>
      }
    >
      Tautan yang kamu buka tidak tersedia atau sudah dipindahkan.
    </EmptyState>
  )
}
