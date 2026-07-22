import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useVerifyEmail, useResendVerification, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, AlertCircle } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendVerification();
  const { data: user, isLoading: isUserLoading } = useGetMe();

  const [verificationStatus, setVerificationStatus] = useState<"pending" | "success" | "error" | "idle">("idle");
  const [resendStatus, setResendStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    // Check for token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token && verificationStatus === "idle") {
      setVerificationStatus("pending");
      verifyMutation.mutate({ data: { token } }, {
        onSuccess: () => {
          setVerificationStatus("success");
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setTimeout(() => {
            setLocation("/dashboard");
          }, 3000);
        },
        onError: () => {
          setVerificationStatus("error");
        }
      });
    }
  }, [verifyMutation, queryClient, setLocation, verificationStatus]);

  useEffect(() => {
    if (user?.emailVerified && verificationStatus === "idle") {
      setLocation("/dashboard");
    }
  }, [user, verificationStatus, setLocation]);

  const handleResend = () => {
    if (!user?.email) return;
    
    setResendStatus("idle");
    resendMutation.mutate({ data: { email: user.email } }, {
      onSuccess: () => {
        setResendStatus("success");
      },
      onError: () => {
        setResendStatus("error");
      }
    });
  };

  if (isUserLoading && !window.location.search.includes("token")) {
    return <div className="min-h-screen bg-background flex items-center justify-center" />;
  }

  if (verificationStatus === "pending") {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
        <h2 className="text-xl font-medium">Verifying your email...</h2>
      </div>
    );
  }

  if (verificationStatus === "success") {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-card border border-card-border p-8 rounded-xl shadow-sm text-center">
          <CheckCircle className="w-16 h-16 text-primary mx-auto mb-6" />
          <h2 className="text-2xl font-semibold mb-2">Email Verified!</h2>
          <p className="text-muted-foreground mb-6">Your account is now active.</p>
          <p className="text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-card border border-card-border p-8 rounded-xl shadow-sm text-center">
        <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-10 h-10 text-primary" />
        </div>
        
        <h2 className="text-2xl font-semibold mb-2">Check your email</h2>
        <p className="text-muted-foreground mb-8">
          We've sent a verification link to <br/>
          <span className="font-medium text-foreground">{user?.email || "your email address"}</span>
        </p>

        {verificationStatus === "error" && (
          <Alert variant="destructive" className="mb-6 text-left">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {(verifyMutation.error as any)?.data?.error || "Verification link is invalid or expired. Please request a new one."}
            </AlertDescription>
          </Alert>
        )}

        {resendStatus === "success" && (
          <Alert className="mb-6 bg-green-50 text-green-900 border-green-200 text-left">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription>
              A new verification link has been sent to your email.
            </AlertDescription>
          </Alert>
        )}

        {resendStatus === "error" && (
          <Alert variant="destructive" className="mb-6 text-left">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {(resendMutation.error as any)?.data?.error || "Failed to resend email. Please try again later."}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleResend}
            disabled={resendMutation.isPending || !user}
          >
            {resendMutation.isPending ? "Sending..." : "Resend Verification Email"}
          </Button>
          
          <div className="text-sm text-muted-foreground pt-4 border-t border-border">
            <Link href="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
