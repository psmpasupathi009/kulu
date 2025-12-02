"use client"

import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {user?.role === 'ADMIN' ? (
        <Card>
          <CardHeader>
            <CardTitle>Admin Settings</CardTitle>
            <CardDescription>
              You have full access to manage all aspects of the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Permissions</h3>
                <p className="text-sm text-muted-foreground">
                  As an admin, you can:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>Create, edit, and delete members</li>
                  <li>Manage savings and loan transactions</li>
                  <li>Upload photos and PDFs</li>
                  <li>Create and manage events</li>
                  <li>Upload monthly statements</li>
                  <li>View all user data</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>User Settings</CardTitle>
            <CardDescription>
              View-only access to your account information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Only admins can change and upload all things. Regular users can only see the details.
              </AlertDescription>
            </Alert>
            <div className="mt-4 space-y-2">
              <div>
                <span className="text-sm font-medium">Email:</span>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Name:</span>
                <p className="text-sm text-muted-foreground">{user?.name || 'Not set'}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Role:</span>
                <p className="text-sm text-muted-foreground">{user?.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

