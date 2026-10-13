import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { toUserMessage } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'
import { signUp } from './api'

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters'),
})
type Values = z.infer<typeof schema>

export default function SignupPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    try {
      const signedIn = await signUp(email, password)
      if (signedIn) navigate('/onboarding', { replace: true })
      else setSentTo(email)
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not create the account. Please try again.'))
    }
  })

  if (sentTo) {
    return (
      <AuthLayout title="Confirm your email" description={<>We sent a confirmation link to <strong className="text-ink">{sentTo}</strong>. Open it to finish creating your account.</>}
        footer={<Link to="/login" className="font-semibold text-teal underline-offset-4 hover:underline">Back to sign in</Link>}>
        <p className="text-sm text-ink-soft">The link can take a minute to arrive. Check your spam folder if you do not see it.</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Set up takes about two minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-teal underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && (
          <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">
            {formError}
          </p>
        )}
        <TextInput label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <TextInput
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
