"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Savings</h1>
          <p className="text-muted-foreground">View member savings</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Savings</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}

