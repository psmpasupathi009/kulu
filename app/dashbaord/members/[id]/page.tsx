"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Member {
  id: string
  userId: string
  name: string
  fatherName?: string
  address1?: string
  address2?: string
  accountNumber?: string
  phone?: string
  photo?: string
}

export default function MemberDetailPage() {
  const params = useParams()
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchMember(params.id as string)
    }
  }, [params.id])

  const fetchMember = async (id: string) => {
    try {
      const response = await fetch(`/api/members/${id}`)
      if (response.ok) {
        const data = await response.json()
        setMember(data.member)
      }
    } catch (error) {
      console.error('Error fetching member:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!member) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/dashbaord/members">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Members
          </Link>
        </Button>
        <div>Member not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/dashbaord/members">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Member Details</h1>
          <p className="text-muted-foreground">View member information</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-lg">{member.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Father Name</label>
              <p className="text-lg">{member.fatherName || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Address 1</label>
              <p className="text-lg">{member.address1 || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Account Number</label>
              <p className="text-lg">{member.accountNumber || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
              <p className="text-lg">{member.phone || '-'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photo</CardTitle>
          </CardHeader>
          <CardContent>
            {member.photo ? (
              <div className="relative w-full h-64 rounded-lg overflow-hidden">
                <Image
                  src={member.photo}
                  alt={member.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-64 rounded-lg bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">No photo uploaded</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

