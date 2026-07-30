
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Made4UFoodsLogo } from '@/components/logo';
import { useProduction } from '@/lib/store';
import type { User } from '@/lib/types';
import { useIsClient } from '@/hooks/use-is-client';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { db, app } from '@/lib/firebase';
import { collection, query, where, getDocs } from "firebase/firestore";

const auth = getAuth(app);

const loginSchema = z.object({
  pin: z.string().length(6, { message: 'PIN must be exactly 6 digits' }).regex(/^\d+$/, { message: "PIN must be numeric" }),
});

type LoginSchema = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { login, userRole, isDataLoading, users } = useProduction();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    if (!isClient || isDataLoading) return;
    
    if (userRole) {
      const roleRedirects: { [key: string]: string } = {
        admin: '/dashboard/tasks',
        bank: '/dashboard/view-calendar',
        employee: '/dashboard/staffing',
        miffy: '/dashboard/view-calendar',
      };
      router.replace(roleRedirects[userRole] || '/dashboard');
    }
  }, [userRole, isDataLoading, router, isClient]);


  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit: SubmitHandler<LoginSchema> = async (data) => {
    setIsLoggingIn(true);
    
    try {
      // 1. Find user in Firestore by PIN
      const user = users.find(u => u.pin === data.pin);

      if (!user) {
        throw new Error("Invalid PIN. Please try again.");
      }
      
      const email = `${user.name.replace(/\s+/g, '.').toLowerCase()}@productionflow.app`;

      // 2. Sign in with Firebase Auth
      await signInWithEmailAndPassword(auth, email, data.pin);

      // 3. Set user state in the app
      login(user.role, user.name, user.id);

      toast({
        title: 'Login Successful',
        description: `Welcome back, ${user.name}!`,
      });

      const roleRedirects: { [key: string]: string } = {
        admin: '/dashboard/tasks',
        bank: '/dashboard/view-calendar',
        employee: '/dashboard/staffing',
        miffy: '/dashboard/view-calendar',
      };
      router.push(roleRedirects[user.role] || '/dashboard');

    } catch (error: any) {
       console.error("Login attempt failed:", error);
       let description = error.message;
       if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
          description = 'Invalid PIN. Please check your PIN or contact an administrator if you are a new user.';
       } else if (error.code === 'auth/operation-not-allowed') {
          description = 'Email/password sign-in is not enabled in Firebase. Please contact an administrator.';
       }
       toast({
        variant: 'destructive',
        title: 'Login Failed',
        description,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const formDisabled = isLoggingIn || isDataLoading;

  if (!isClient) {
    return (
       <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (userRole && !isDataLoading) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
      <Card className="w-full max-w-sm z-10 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Made4UFoodsLogo className="h-24 w-auto" />
          </div>
          <CardTitle className="text-3xl font-bold">Made4U Flow</CardTitle>
          <CardDescription>
            Log in to access your production dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">6-digit Employee PIN</Label>
              <Input
                id="pin"
                type="password"
                placeholder="••••••"
                {...register('pin')}
                aria-invalid={errors.pin ? 'true' : 'false'}
                disabled={formDisabled}
                maxLength={6}
              />
              {errors.pin && (
                <p className="text-xs text-destructive">
                  {errors.pin.message}
                </p>
              )}
            </div>
             <Button type="submit" className="w-full" disabled={formDisabled}>
              {isDataLoading ? (
                 <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading Data...
                </>
              ) : isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Log In'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground text-center w-full">
            © {new Date().getFullYear()} Made4U Flow. All rights reserved.
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
