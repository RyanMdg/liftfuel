import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { toUserMessage } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'
import { signIn } from './api'

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    try {
      await signIn(email, password)
      // RedirectIfSignedIn navigates once the session arrives.
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not sign in. Check your email and password.'))
    }
  })

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-semibold text-teal underline-offset-4 hover:underline">
            Create an account
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
          autoComplete="current-password"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <div className="flex items-center justify-between gap-4">
          <Button type="submit" loading={formState.isSubmitting}>
            Sign in
          </Button>
          <Link to="/reset-password" className="text-sm font-semibold text-teal underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
