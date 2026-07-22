import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoColor from "@assets/logo-full-colour.png";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user && !isLoading) {
      if (user.role === 'admin') {
        setLocation("/admin");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, isLoading, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        // The useEffect will handle the redirect once user is fetched
      },
    });
  };

  if (isLoading || user) {
    return <div className="min-h-screen bg-background flex items-center justify-center" />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-card border border-card-border p-8 rounded-xl shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logoColor} alt="Active Impact" className="h-12 object-contain mb-6" />
          <h1 className="text-2xl font-semibold text-foreground text-center">Sign in to Talent Hub</h1>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Access pre-vetted climate tech talent
          </p>
        </div>

        {loginMutation.error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              {(loginMutation.error as any)?.data?.error || "Failed to log in. Please check your credentials."}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="founder@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full mt-6" 
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Form>

        <div className="mt-8 text-center text-sm text-muted-foreground border-t border-border pt-6">
          Portfolio company founder?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
