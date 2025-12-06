"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { Download } from 'lucide-react'

interface Statement {
  id: string
  month: number
  year: number
  pdfUrl?: string
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    fetchStatements()
  }, [])

  const fetchStatements = async () => {
    try {
      const response = await fetch('/api/statements')
      if (response.ok) {
        const data = await response.json()
        setStatements(data.statements)
      }
    } catch (error) {
      console.error('Error fetching statements:', error)
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
          <h1 className="text-3xl font-bold">Monthly Statements</h1>
          <p className="text-muted-foreground">View and download monthly statements</p>
        </div>
        {user?.role === 'ADMIN' && (
          <Button>Upload Statement</Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Statements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No statements found
                    </TableCell>
                  </TableRow>
                ) : (
                  statements.map((statement, index) => (
                    <TableRow key={statement.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {monthNames[statement.month - 1]} {statement.year}
                      </TableCell>
                      <TableCell>
                        {statement.pdfUrl ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={statement.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">Not available</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

