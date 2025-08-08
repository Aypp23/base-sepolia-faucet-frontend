import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ timeRemaining: number; timeString: string } | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const { toast } = useToast();

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address);

  // Countdown timer for rate limit
  useEffect(() => {
    if (!rateLimitInfo || rateLimitInfo.timeRemaining <= 0) {
      setRateLimitInfo(null);
      return;
    }

    const timer = setInterval(() => {
      setRateLimitInfo(prev => {
        if (!prev || prev.timeRemaining <= 1) {
          return null;
        }
        
        const newTimeRemaining = prev.timeRemaining - 1;
        const hours = Math.floor(newTimeRemaining / 3600);
        const minutes = Math.floor((newTimeRemaining % 3600) / 60);
        const seconds = newTimeRemaining % 60;
        
        let timeString = '';
        if (hours > 0) {
          timeString = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
          timeString = `${minutes}m ${seconds}s`;
        } else {
          timeString = `${seconds}s`;
        }
        
        return {
          timeRemaining: newTimeRemaining,
          timeString
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitInfo]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!isValidAddress) {
      setError("Please enter a valid Ethereum address.");
      return;
    }
    if (!captchaToken) {
      setError("Please complete the reCAPTCHA verification.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://base-sepolia-faucet-backend.onrender.com/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, captchaToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Handle rate limit with time remaining
        if (res.status === 429 && data.timeString) {
          setRateLimitInfo({
            timeRemaining: data.timeRemaining,
            timeString: data.timeString
          });
          return; // Don't throw error, just show the countdown
        }
        throw new Error(data?.error || data?.message || "Request failed. Please try again later.");
      }
      const txHash: string | undefined = data?.txHash || data?.hash || data?.transactionHash;
      if (txHash) {
        const explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`;
        toast({
          title: "Success! ETH sent",
          description: (
            <div className="space-y-2">
              <p>Your request has been processed successfully!</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Transaction:</span>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline underline-offset-4 font-mono text-sm"
                >
                  {txHash.slice(0, 10)}…{txHash.slice(-8)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the transaction hash to view it on Base Sepolia Explorer
              </p>
            </div>
          ),
          duration: 10000, // 10 seconds
        });
        // Clear the form and reset reCAPTCHA after successful request
        setAddress("");
        if (recaptchaRef.current) {
          recaptchaRef.current.reset();
        }
        setCaptchaToken(null);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
    setError(null);
  };

  return (
    <div className="app-ambient min-h-screen">
      <main className="container mx-auto flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <img 
              src="/incoo.jpg" 
              alt="Incoo Logo" 
              className="w-16 h-16 mb-4 rounded-lg shadow-sm"
            />
            <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Base Sepolia Faucet</h1>
          </div>
          <Card className="shadow-sm">
            <CardHeader>
              <CardDescription>Get test ETH for Base Sepolia to try Inco dApps.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Wallet Address</Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="0x..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value.trim())}
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="text"
                    aria-invalid={address.length > 0 && !isValidAddress}
                    aria-describedby="address-help"
                  />
                  <p id="address-help" className="text-xs text-muted-foreground">
                    Enter your Base-compatible Ethereum address.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Verification</Label>
                  <div className="flex justify-center">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey="6LePiJ4rAAAAAINk-mwC2Eb0VHYLqZmHXcGQkE4x"
                      onChange={handleCaptchaChange}
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {rateLimitInfo && (
                  <Alert variant="default" className="border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="text-orange-800">Rate Limited</AlertTitle>
                    <AlertDescription className="text-orange-700">
                      You can request again in: <span className="font-mono font-bold">{rateLimitInfo.timeString}</span>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2 pt-2">
                  <Button type="submit" disabled={loading || !isValidAddress || !captchaToken} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      "Request ETH"
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Rate limited: 1 request per 24h per address
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <footer className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Built by{" "}
              <a 
                href="https://x.com/ololade_eth" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline underline-offset-4 font-medium"
              >
                ololade_eth
              </a>
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
};

export default Index;
