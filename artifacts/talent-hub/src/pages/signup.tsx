import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSignup, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import logoColor from "@assets/logo-full-colour.png";
import { AlertCircle } from "lucide-react";

const signupSchema = z.object({
  name: z.string().min(2, "Name is required"),
  company: z.string().min(2, "Company name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function Signup() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const signupMutation = useSignup();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", company: "", email: "", password: "" },
  });

  const onSubmit = (data: z.infer<typeof signupSchema>) => {
    signupMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/verify-email");
      },
    });
  };

  const errorMsg: string | undefined = (signupMutation.error as any)?.data?.error;
  const isDomainError = errorMsg?.toLowerCase().includes("whitelist") || errorMsg?.toLowerCase().includes("domain");

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 py-12">
      <div className="w-full max-w-md bg-card border border-card-border p-8 rounded-xl shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logoColor} alt="Active Impact" className="h-12 object-contain mb-6" />
          <h1 className="text-2xl font-semibold text-foreground text-center">Join Talent Hub</h1>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Exclusive access for Active Impact Investments portfolio founders.
          </p>
        </div>

        {signupMutation.error && (
          <Alert variant={isDomainError ? "default" : "destructive"} className={`mb-6 ${isDomainError ? "bg-amber-50 border-amber-200 text-amber-900" : ""}`}>
            {isDomainError && <AlertCircle className="w-4 h-4 text-amber-600" />}
            {isDomainError && <AlertTitle className="text-amber-800">Email Domain Not Recognized</AlertTitle>}
            <AlertDescription>
              {isDomainError 
                ? "It looks like your email domain isn't in our portfolio network yet. If you are an Active Impact portfolio company, please reach out to the team to get your domain whitelisted."
                : errorMsg || "Failed to create account. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Climate Tech" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Email</FormLabel>
                  <FormControl>
                    <Input placeholder="jane@company.com" {...field} />
                  </FormControl>
                  <FormDescription>Must be your portfolio company email address.</FormDescription>
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
              disabled={signupMutation.isPending}
            >
              {signupMutation.isPending ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </Form>

        <div className="mt-8 text-center text-sm text-muted-foreground border-t border-border pt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
