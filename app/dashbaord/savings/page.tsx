"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Plus } from 'lucide-react'

interface Savings {
  id: string
  member: {
    id: string
    name: string
    userId: string
  }
  totalAmount: number
}

export default function SavingsPage() {
  const [savings, setSavings] = useState<Savings[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    fetchSavings()
  }, [])

  const fetchSavings = async () => {
    try {
      const response = await fetch('/api/savings')
      if (response.ok) {
        const data = await response.json()
        setSavings(data.savings)
      }
    } catch (error) {
      console.error('Error fetching savings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Savings</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">View member savings</p>
        </div>
        {user?.role === 'ADMIN' && (
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashbaord/savings/new">
              <Plus className="mr-2 h-4 w-4" />
              Record Contribution
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Savings</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Member Name</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Total Savings</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {savings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No savings records found
                  </TableCell>
                </TableRow>
              ) : (
                savings.map((saving, index) => (
                  <TableRow key={saving.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{saving.member.name}</TableCell>
                    <TableCell>{saving.member.userId}</TableCell>
                    <TableCell>₹{saving.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashbaord/savings/${saving.id}`}>View Details</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

