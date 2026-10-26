import { useNavigate, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * Glass error card (D-15). Kept free of brand-page / language-switch / direction-provider
 * imports: error-map.test.ts imports every error component in plain node (Pitfall 7).
 */
export function ErrorPanel({
  code,
  title,
  body,
}: {
  code: string
  title: string
  body: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <Card className='items-center gap-2 p-6 text-center'>
      <p className='font-display text-muted-foreground text-[28px] leading-[1.15] font-semibold tabular-nums'>
        {code}
      </p>
      <h1 className='font-display text-lg font-semibold'>{title}</h1>
      <p className='text-muted-foreground max-w-[420px] text-sm'>{body}</p>
      <div className='mt-6 flex flex-wrap justify-center gap-2'>
        <Button variant='outline' onClick={() => history.go(-1)}>
          {t('errors.goBack')}
        </Button>
        <Button variant='pill' onClick={() => navigate({ to: '/' })}>
          {t('errors.backToHome')}
        </Button>
      </div>
    </Card>
  )
}
