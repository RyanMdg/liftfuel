import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { toUserMessage } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './AuthProvider'
import { requestPasswordReset, updatePassword } from './api'

const requestSchema = z.object({ email: z.email('Enter a valid email address') })
const updateSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })

export default function ResetPasswordPage() {
  const { passwordRecovery } = useAuth()
  return passwordRecovery ? <SetNewPassword /> : <RequestReset />
}

function RequestReset() {
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof requestSchema>>({ resolver: zodResolver(requestSchema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not send the reset email. Please try again.'))
    }
  })

  return (
    <AuthLayout
      title="Reset your password"
      description={sent ? 'If an account exists for that email, a reset link is on its way.' : 'We will email you a link to set a new password.'}
      footer={<Link to="/login" className="font-semibold text-teal underline-offset-4 hover:underline">Back to sign in</Link>}
    >
      {!sent && (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{formError}</p>}
          <TextInput label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
          <Button type="submit" loading={formState.isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  )
}

function SetNewPassword() {
  const navigate = useNavigate()
  const toast = useToast()
  const { clearPasswordRecovery } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof updateSchema>>({ resolver: zodResolver(updateSchema) })

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null)
    try {
      await updatePassword(password)
      clearPasswordRecovery()
      toast.success('Password updated.')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not update the password. The link may have expired.'))
    }
  })

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{formError}</p>}
        <TextInput label="New password" type="password" autoComplete="new-password" error={formState.errors.password?.message} {...register('password')} />
        <TextInput label="Confirm new password" type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" loading={formState.isSubmitting}>Update password</Button>
      </form>
    </AuthLayout>
  )
}
