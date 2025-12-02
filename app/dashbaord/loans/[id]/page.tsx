"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'

interface LoanTransaction {
  id: string
  date: string
  amount: number
  interest: number
  remaining: number
  week: number
}

interface Loan {
  id: string
  member: {
    name: string
    userId: string
  }
  principal: number
  remaining: number
  currentWeek: number
  weeks: number
  interestRate: number
  transactions: LoanTransaction[]
}

export default function LoanDetailPage() {
  const params = useParams()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchLoan(params.id as string)
    }
  }, [params.id])

  const fetchLoan = async (id: string) => {
    try {
      const response = await fetch(`/api/loans/${id}`)
      if (response.ok) {
        const data = await response.json()
        setLoan(data.loan)
      }
    } catch (error) {
      console.error('Error fetching loan:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!loan) {
    return <div>Loan not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/dashbaord/loans">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Loan Details</h1>
          <p className="text-muted-foreground">{loan.member.name} - {loan.member.userId}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Principal:</span>
              <span className="font-medium">₹{loan.principal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium">₹{loan.remaining.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate:</span>
              <span className="font-medium">{loan.interestRate}% per week</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Progress:</span>
              <span className="font-medium">{loan.currentWeek}/{loan.weeks} weeks</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Weekly payment includes principal and 1% interest on remaining balance.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Week</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loan.transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                loan.transactions.map((transaction, index) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{format(new Date(transaction.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>₹{transaction.amount.toFixed(2)}</TableCell>
                    <TableCell>₹{transaction.interest.toFixed(2)}</TableCell>
                    <TableCell>₹{transaction.remaining.toFixed(2)}</TableCell>
                    <TableCell>{transaction.week}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

