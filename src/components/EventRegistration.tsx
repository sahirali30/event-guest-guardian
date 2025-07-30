import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

interface RegistrationData {
  id: string;
  registered_at: string;
  invited_guests: {
    name: string;
    email: string;
    max_guests: number;
  };
  guest_registrations: {
    guest_name: string;
    guest_email: string | null;
  }[];
}

export default function EventRegistration() {
  const [email, setEmail] = useState("");
  const [invitedGuest, setInvitedGuest] = useState<InvitedGuest | null>(null);
  const [guests, setGuests] = useState<GuestInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [showAdminView, setShowAdminView] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationData[]>([]);
  const { toast } = useToast();

  const fetchAllRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from("registrations")
        .select(`
          id,
          registered_at,
          invited_guests (
            name,
            email,
            max_guests
          ),
          guest_registrations (
            guest_name,
            guest_email
          )
        `);

      if (error) throw error;
      setRegistrations(data as RegistrationData[]);
    } catch (error) {
      console.error("Error fetching registrations:", error);
      toast({
        title: "Error",
        description: "Failed to load registration data.",
        variant: "destructive",
      });
    }
  };

  const handleEmailCheck = async () => {
    setEmailError("");
    
    if (!email) {
      setEmailError("Please enter your email address");
      return;
    }

    // Check for admin code
    if (email.toLowerCase() === "admincode@modivc.com") {
      setIsLoading(true);
      await fetchAllRegistrations();
      setShowAdminView(true);
      setIsLoading(false);
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
    setShowAdminView(false);
    setRegistrations([]);
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
      </Card>
    );
  }

  if (showAdminView) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Admin View - All Registrations</CardTitle>
          <CardDescription>
            Complete list of event registrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Button onClick={resetForm} variant="outline">
              Back to Registration
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invited Guest</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Max Guests</TableHead>
                <TableHead>Registered At</TableHead>
                <TableHead>Additional Guests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((registration) => (
                <TableRow key={registration.id}>
                  <TableCell className="font-medium">
                    {registration.invited_guests.name}
                  </TableCell>
                  <TableCell>{registration.invited_guests.email}</TableCell>
                  <TableCell>{registration.invited_guests.max_guests}</TableCell>
                  <TableCell>
                    {new Date(registration.registered_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {registration.guest_registrations.length > 0 ? (
                      <div className="space-y-1">
                        {registration.guest_registrations.map((guest, index) => (
                          <div key={index} className="text-sm">
                            {guest.guest_name}
                            {guest.guest_email && ` (${guest.guest_email})`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No additional guests</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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