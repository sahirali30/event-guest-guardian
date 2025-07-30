import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InvitedGuest {
  id: string;
  email: string;
  name: string;
  max_guests: number;
}

interface GuestInfo {
  name: string;
  email: string;
}

export default function EventRegistration() {
  const [email, setEmail] = useState("");
  const [invitedGuest, setInvitedGuest] = useState<InvitedGuest | null>(null);
  const [guests, setGuests] = useState<GuestInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [emailError, setEmailError] = useState("");
  const { toast } = useToast();

  const handleEmailCheck = async () => {
    setEmailError("");
    
    if (!email) {
      setEmailError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("invited_guests")
        .select("*")
        .eq("email", email.toLowerCase())
        .single();

      if (error) {
        setEmailError("Your email is not on the invitation list for this event.");
        setInvitedGuest(null);
        return;
      }

      // Check if already registered
      const { data: existingRegistration } = await supabase
        .from("registrations")
        .select("*")
        .eq("invited_guest_id", data.id)
        .single();

      if (existingRegistration) {
        setEmailError("You have already registered for this event.");
        return;
      }

      setInvitedGuest(data);
      // Initialize guest array based on max_guests
      setGuests(Array(data.max_guests).fill({ name: "", email: "" }));
      
      toast({
        title: "Email Verified!",
        description: `Welcome ${data.name}! You can bring up to ${data.max_guests} guests.`,
      });
    } catch (error) {
      console.error("Error checking email:", error);
      setEmailError("An error occurred while checking your email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestChange = (index: number, field: keyof GuestInfo, value: string) => {
    const updatedGuests = [...guests];
    updatedGuests[index] = { ...updatedGuests[index], [field]: value };
    setGuests(updatedGuests);
  };

  const handleRegistration = async () => {
    if (!invitedGuest) return;

    setIsLoading(true);
    try {
      // Create registration record
      const { data: registration, error: regError } = await supabase
        .from("registrations")
        .insert({ invited_guest_id: invitedGuest.id })
        .select()
        .single();

      if (regError) throw regError;

      // Add guest registrations if any
      const guestsToRegister = guests.filter(guest => guest.name.trim() !== "");
      if (guestsToRegister.length > 0) {
        const guestRegistrations = guestsToRegister.map(guest => ({
          registration_id: registration.id,
          guest_name: guest.name,
          guest_email: guest.email || null,
        }));

        const { error: guestError } = await supabase
          .from("guest_registrations")
          .insert(guestRegistrations);

        if (guestError) throw guestError;
      }

      setIsRegistered(true);
      toast({
        title: "Registration Successful!",
        description: `You have been registered for the event${guestsToRegister.length > 0 ? ` with ${guestsToRegister.length} guest${guestsToRegister.length > 1 ? 's' : ''}` : ''}.`,
      });
    } catch (error) {
      console.error("Error registering:", error);
      toast({
        title: "Registration Failed",
        description: "An error occurred while registering. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setInvitedGuest(null);
    setGuests([]);
    setIsRegistered(false);
    setEmailError("");
  };

  if (isRegistered) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Registration Complete!</CardTitle>
          <CardDescription>
            Thank you for registering. We look forward to seeing you at the event!
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={resetForm} variant="outline">
            Register Another Guest
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Event Registration</CardTitle>
        <CardDescription>
          Please enter your email address to check your invitation status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <div className="flex gap-2">
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!invitedGuest}
              className={emailError ? "border-destructive" : ""}
            />
            {!invitedGuest && (
              <Button onClick={handleEmailCheck} disabled={isLoading}>
                {isLoading ? "Checking..." : "Check"}
              </Button>
            )}
          </div>
          {emailError && (
            <p className="text-sm text-destructive mt-1">{emailError}</p>
          )}
        </div>

        {invitedGuest && (
          <div className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <h3 className="font-semibold text-primary">Welcome, {invitedGuest.name}!</h3>
              <p className="text-sm text-muted-foreground">
                You are invited to the event and can bring up to {invitedGuest.max_guests} guest{invitedGuest.max_guests !== 1 ? 's' : ''}.
              </p>
            </div>

            {invitedGuest.max_guests > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Guest Information</h4>
                {guests.map((guest, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor={`guest-name-${index}`}>Guest {index + 1} Name</Label>
                      <Input
                        id={`guest-name-${index}`}
                        placeholder="Guest name (optional)"
                        value={guest.name}
                        onChange={(e) => handleGuestChange(index, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`guest-email-${index}`}>Guest {index + 1} Email</Label>
                      <Input
                        id={`guest-email-${index}`}
                        type="email"
                        placeholder="Guest email (optional)"
                        value={guest.email}
                        onChange={(e) => handleGuestChange(index, "email", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={handleRegistration} disabled={isLoading} className="w-full">
              {isLoading ? "Registering..." : "Complete Registration"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}