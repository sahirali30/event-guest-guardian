import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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
  will_attend: boolean;
  modified_after_initial: boolean;
  last_modified_at: string;
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
  const [showCompleteListView, setShowCompleteListView] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationData[]>([]);
  const [completeAttendeeList, setCompleteAttendeeList] = useState<any[]>([]);
  const [existingRegistration, setExistingRegistration] = useState<any>(null);
  const [willAttend, setWillAttend] = useState(true);
  const [rsvpSettings, setRsvpSettings] = useState<{ is_open: boolean } | null>(null);
  const [showAdminToggle, setShowAdminToggle] = useState(false);
  const { toast } = useToast();

  const fetchRsvpSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("rsvp_settings")
        .select("is_open")
        .single();

      if (error) throw error;
      setRsvpSettings(data);
    } catch (error) {
      console.error("Error fetching RSVP settings:", error);
      // If no settings found, default to open
      setRsvpSettings({ is_open: true });
    }
  };

  const toggleRsvpStatus = async () => {
    if (!rsvpSettings) return;
    
    try {
      const { error } = await supabase
        .from("rsvp_settings")
        .update({ is_open: !rsvpSettings.is_open })
        .eq("id", (await supabase.from("rsvp_settings").select("id").single()).data?.id);

      if (error) throw error;
      
      setRsvpSettings({ is_open: !rsvpSettings.is_open });
      toast({
        title: "RSVP Status Updated",
        description: `RSVP is now ${!rsvpSettings.is_open ? 'open' : 'closed'}.`,
      });
    } catch (error) {
      console.error("Error updating RSVP status:", error);
      toast({
        title: "Error",
        description: "Failed to update RSVP status.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchRsvpSettings();
  }, []);

  const fetchAllRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from("registrations")
        .select(`
          id,
          registered_at,
          will_attend,
          modified_after_initial,
          last_modified_at,
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

  const fetchCompleteAttendeeList = async () => {
    try {
      const { data, error } = await supabase
        .from("registrations")
        .select(`
          id,
          registered_at,
          will_attend,
          invited_guests (
            name,
            email
          ),
          guest_registrations (
            guest_name,
            guest_email
          )
        `)
        .eq('will_attend', true);

      if (error) throw error;
      
      // Create flat list of all attendees
      const attendeeList: any[] = [];
      
      data.forEach((registration) => {
        // Add primary guest
        attendeeList.push({
          name: registration.invited_guests.name,
          email: registration.invited_guests.email,
          registered_on: registration.registered_at,
          primary_guest: registration.invited_guests.name,
          is_primary: true
        });
        
        // Add additional guests
        registration.guest_registrations.forEach((guest) => {
          attendeeList.push({
            name: guest.guest_name,
            email: guest.guest_email || 'Not provided',
            registered_on: registration.registered_at,
            primary_guest: registration.invited_guests.name,
            is_primary: false
          });
        });
      });
      
      setCompleteAttendeeList(attendeeList);
    } catch (error) {
      console.error("Error fetching complete attendee list:", error);
      toast({
        title: "Error",
        description: "Failed to load attendee data.",
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
      setShowAdminToggle(true);
      setIsLoading(false);
      return;
    }

    // Check for complete list admin code
    if (email.toLowerCase() === "completelist@modivc.com") {
      setIsLoading(true);
      await fetchCompleteAttendeeList();
      setShowCompleteListView(true);
      setIsLoading(false);
      return;
    }

    // Check if RSVP is closed for regular users
    if (rsvpSettings && !rsvpSettings.is_open) {
      setEmailError("");
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
      const { data: existingReg, error: regError } = await supabase
        .from("registrations")
        .select(`
          *,
          guest_registrations (
            id,
            guest_name,
            guest_email
          )
        `)
        .eq("invited_guest_id", data.id)
        .maybeSingle();

      if (existingReg) {
        setExistingRegistration(existingReg);
        setInvitedGuest(data);
        setWillAttend(existingReg.will_attend);
        
        // Initialize guests array with existing data
        const existingGuests = existingReg.guest_registrations || [];
        const guestArray = Array(data.max_guests).fill({ name: "", email: "" });
        existingGuests.forEach((guest, index) => {
          if (index < data.max_guests) {
            guestArray[index] = { name: guest.guest_name, email: guest.guest_email || "" };
          }
        });
        setGuests(guestArray);
        
        toast({
          title: "Registration Found!",
          description: `You can modify your registration details below.`,
        });
        return;
      }

      setInvitedGuest(data);
      setExistingRegistration(null);
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

    // Validate guest information - if name is provided, email is required
    const invalidGuests = guests.filter(guest => guest.name.trim() !== "" && guest.email.trim() === "");
    if (invalidGuests.length > 0) {
      toast({
        title: "Missing Guest Email",
        description: "Please provide email addresses for all guests with names.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (existingRegistration) {
        // Update existing registration
        const { error: updateError } = await supabase
          .from("registrations")
          .update({ will_attend: willAttend })
          .eq("id", existingRegistration.id);

        if (updateError) throw updateError;

        // Delete existing guest registrations
        const { error: deleteError } = await supabase
          .from("guest_registrations")
          .delete()
          .eq("registration_id", existingRegistration.id);

        if (deleteError) throw deleteError;

        // Add new guest registrations if any
        const guestsToRegister = guests.filter(guest => guest.name.trim() !== "");
        if (guestsToRegister.length > 0) {
          const guestRegistrations = guestsToRegister.map(guest => ({
            registration_id: existingRegistration.id,
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
          title: "Registration Updated!",
          description: willAttend 
            ? `Your registration has been updated${guestsToRegister.length > 0 ? ` with ${guestsToRegister.length} guest${guestsToRegister.length > 1 ? 's' : ''}` : ''}.`
            : "Your attendance status has been updated to 'Not Attending'.",
        });
      } else {
        // Create new registration
        const { data: registration, error: regError } = await supabase
          .from("registrations")
          .insert({ 
            invited_guest_id: invitedGuest.id,
            will_attend: willAttend 
          })
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
          description: willAttend 
            ? `You have been registered for the event${guestsToRegister.length > 0 ? ` with ${guestsToRegister.length} guest${guestsToRegister.length > 1 ? 's' : ''}` : ''}.`
            : "Your registration has been saved as 'Not Attending'.",
        });
      }
    } catch (error) {
      console.error("Error registering:", error);
      toast({
        title: "Registration Failed",
        description: "An error occurred while processing your registration. Please try again.",
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
    setShowCompleteListView(false);
    setRegistrations([]);
    setCompleteAttendeeList([]);
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
        <CardContent className="text-center space-y-4">
          <div className="bg-muted/50 p-6 rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              We will send detailed agenda for the Sept 9th meeting and dinner reception.
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Timing:</span> 5-10p
              </div>
              <div>
                <span className="font-medium">Location:</span> TMC3, Helix Park Houston, TX
              </div>
              <div>
                <span className="font-medium">Hotel:</span> We've reserved a hotel block within walking distance of the venue. Full details and booking information will be shared shortly.
              </div>
            </div>
          </div>
        </CardContent>
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
          <div className="mb-4 flex justify-between items-center">
            <Button onClick={resetForm} variant="outline">
              Back to Registration
            </Button>
            {showAdminToggle && rsvpSettings && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  RSVP Status: 
                  <span className={rsvpSettings.is_open ? "text-green-600 ml-1" : "text-red-600 ml-1"}>
                    {rsvpSettings.is_open ? "Open" : "Closed"}
                  </span>
                </span>
                <Button 
                  onClick={toggleRsvpStatus}
                  variant={rsvpSettings.is_open ? "destructive" : "default"}
                  size="sm"
                >
                  {rsvpSettings.is_open ? "Close RSVP" : "Open RSVP"}
                </Button>
              </div>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invited Guest</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Will Attend</TableHead>
                <TableHead>Max Guests</TableHead>
                <TableHead>Registered At</TableHead>
                <TableHead>Modified</TableHead>
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
                  <TableCell>
                    <span className={registration.will_attend ? "text-green-600" : "text-red-600"}>
                      {registration.will_attend ? "Yes" : "No"}
                    </span>
                  </TableCell>
                  <TableCell>{registration.invited_guests.max_guests}</TableCell>
                  <TableCell>
                    {new Date(registration.registered_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Checkbox 
                      checked={registration.modified_after_initial} 
                      disabled 
                    />
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

  if (showCompleteListView) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Attendee List</CardTitle>
          <CardDescription>
            All confirmed attendees including guests
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
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Registered On</TableHead>
                <TableHead>Primary Guest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completeAttendeeList.map((attendee, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {attendee.name}
                    {attendee.is_primary && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">Primary</span>}
                  </TableCell>
                  <TableCell>{attendee.email}</TableCell>
                  <TableCell>
                    {new Date(attendee.registered_on).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{attendee.primary_guest}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 text-sm text-muted-foreground">
            Total Attendees: {completeAttendeeList.length}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show RSVP closed message immediately if RSVP is closed (before any form interaction)
  if (rsvpSettings && !rsvpSettings.is_open) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-destructive">RSVP Has Now Closed</CardTitle>
          <CardDescription>
            Thank you for your interest in the MVC Annual Gathering 2025
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="bg-muted/50 p-6 rounded-lg">
            <p className="text-muted-foreground mb-4">
              Registration for this event is now closed.
            </p>
            <p className="text-muted-foreground">
              Please reach out to <strong>Sahir</strong> or <strong>Amir</strong> for further assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">MVC Annual Gathering 2025 Registration</CardTitle>
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
                You are invited to the event{invitedGuest.max_guests > 0 ? ` and can bring up to ${invitedGuest.max_guests} guest${invitedGuest.max_guests !== 1 ? 's' : ''}.` : '.'}
              </p>
              {existingRegistration && (
                <p className="text-sm text-muted-foreground mt-2">
                  You can modify your registration details or attendance status below.
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="will-attend" 
                checked={willAttend} 
                onCheckedChange={(checked) => setWillAttend(checked as boolean)}
              />
              <Label htmlFor="will-attend">I will attend this MVC event</Label>
            </div>

            {invitedGuest.max_guests > 0 && willAttend && (
              <div className="space-y-4">
                <h4 className="font-medium">Additional Guest Information</h4>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium mb-2">
                    ⚠️ Limited Capacity • Invite Only Event
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Every guest must be registered in advance.
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Primary Guest:</span> {invitedGuest.name}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Please only include additional guest(s) information in the fields below. Do not re-enter your own information.
                  </p>
                </div>
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
              {isLoading ? (existingRegistration ? "Updating..." : "Registering...") : (existingRegistration ? "Update Registration" : "Complete Registration")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}