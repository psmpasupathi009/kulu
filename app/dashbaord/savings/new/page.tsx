"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, DollarSign, Calendar, User } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'

interface Member {
  id: string
  name: string
  userId: string
}

export default function NewSavingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '100',
    date: new Date().toISOString().split('T')[0],
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/members')
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members)
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!formData.memberId) {
      setError('Please select a member')
      setSubmitting(false)
      return
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Amount must be greater than 0')
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: formData.memberId,
          amount: parseFloat(formData.amount),
          date: formData.date,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record contribution')
      }

      setSuccess(`₹${formData.amount} contribution recorded successfully!`)
      setTimeout(() => {
        router.push('/dashbaord/savings')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to record contribution')
    } finally {
      setSubmitting(false)
    }
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>Access denied. Admin privileges required.</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/dashbaord/savings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Savings
          </Link>
        </Button>
      </div>
    )
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashbaord/savings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Record Weekly Contribution</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Record a member's weekly contribution (₹100)</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contribution Details</CardTitle>
          <CardDescription>
            Record weekly contribution. ₹100 contributions automatically go to active cycle's investment pool.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <FieldGroup>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    {success}
                  </AlertDescription>
                </Alert>
              )}

              <Field>
                <FieldLabel htmlFor="memberId">
                  <User className="mr-2 h-4 w-4 inline" />
                  Member <span className="text-destructive">*</span>
                </FieldLabel>
                <select
                  id="memberId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.memberId}
                  onChange={(e) =>
                    setFormData({ ...formData, memberId: e.target.value })
                  }
                  required
                >
                  <option value="">Select a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.userId})
                    </option>
                  ))}
                </select>
                <FieldDescription>Select the member making the contribution</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="amount">
                  <DollarSign className="mr-2 h-4 w-4 inline" />
                  Amount (₹) <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="100"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                />
                <FieldDescription>
                  Weekly contribution amount (typically ₹100). If ₹100, it will automatically be added to active cycle's investment pool.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="date">
                  <Calendar className="mr-2 h-4 w-4 inline" />
                  Date <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
                <FieldDescription>Date of the contribution</FieldDescription>
              </Field>

              <Field>
                <div className="flex gap-4">
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Recording...
                      </>
                    ) : (
                      <>
                        <DollarSign className="mr-2 h-4 w-4" />
                        Record Contribution
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/dashbaord/savings')}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

