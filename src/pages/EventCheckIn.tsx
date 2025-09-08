import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Search, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Seat {
  angle: number;
  guestName?: string;
  tag?: string;
  note?: string;
}

interface Table {
  id: string;
  number: number;
  label: string;
  x: number;
  y: number;
  seats: Seat[];
}

interface Guest {
  name: string;
  email?: string;
  tableNumber?: number;
}

interface CheckIn {
  id: string;
  guest_name: string;
  table_number: number;
  checked_in_at: string;
  checked_out_at?: string;
}

const EventCheckIn = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  const setupAdminContext = useCallback(async () => {
    try {
      await supabase.rpc('set_config', {
        setting_name: 'app.current_user_email',
        setting_value: 'admincode@modivc.com'
      });
    } catch (error) {
      console.error('Error setting admin context:', error);
    }
  }, []);

  const loadTables = useCallback(async () => {
    try {
      await setupAdminContext();
      
      const { data: tableConfigs, error: tablesError } = await supabase
        .from('table_configurations')
        .select('*')
        .order('table_number');

      if (tablesError) throw tablesError;

      const { data: seatAssignments, error: seatsError } = await supabase
        .from('seat_assignments')
        .select('*');

      if (seatsError) throw seatsError;

      const tablesData = tableConfigs?.map(config => {
        const tableSeats = seatAssignments?.filter(seat => 
          seat.table_configuration_id === config.id
        ) || [];

        const seats = Array.from({ length: config.seat_count }, (_, index) => {
          const assignment = tableSeats.find(seat => seat.seat_index === index);
          return {
            angle: assignment?.seat_angle || (360 / config.seat_count) * index,
            guestName: assignment?.guest_name || undefined,
            tag: assignment?.tag || undefined,
            note: assignment?.note || undefined,
          };
        });

        return {
          id: config.id,
          number: config.table_number,
          label: config.label,
          x: Number(config.x),
          y: Number(config.y),
          seats,
        };
      }) || [];

      setTables(tablesData);
    } catch (error) {
      console.error('Error loading tables:', error);
      toast({
        title: "Error",
        description: "Failed to load table configurations.",
        variant: "destructive",
      });
    }
  }, [setupAdminContext, toast]);

  const loadGuests = useCallback(async () => {
    try {
      await setupAdminContext();
      
      const { data: invitedGuests, error: invitedError } = await supabase
        .from('invited_guests')
        .select('name, email');

      const { data: guestRegistrations, error: registrationsError } = await supabase
        .from('guest_registrations')
        .select('guest_name, guest_email');

      if (invitedError) throw invitedError;
      if (registrationsError) throw registrationsError;

      const combinedGuests: Guest[] = [];
      
      // Add invited guests
      invitedGuests?.forEach(guest => {
        combinedGuests.push({
          name: guest.name.trim(),
          email: guest.email,
        });
      });

      // Add guest registrations
      guestRegistrations?.forEach(registration => {
        if (registration.guest_name) {
          combinedGuests.push({
            name: registration.guest_name.trim(),
            email: registration.guest_email || undefined,
          });
        }
      });

      // Find table assignments for each guest
      const guestsWithTables = combinedGuests.map(guest => {
        const assignedTable = tables.find(table => 
          table.seats.some(seat => 
            seat.guestName?.toLowerCase().trim() === guest.name.toLowerCase().trim()
          )
        );
        
        return {
          ...guest,
          tableNumber: assignedTable?.number,
        };
      });

      setGuests(guestsWithTables);
    } catch (error) {
      console.error('Error loading guests:', error);
      toast({
        title: "Error",
        description: "Failed to load guest data.",
        variant: "destructive",
      });
    }
  }, [setupAdminContext, tables, toast]);

  const loadCheckins = useCallback(async () => {
    try {
      await setupAdminContext();
      
      const { data, error } = await supabase
        .from('guest_checkins')
        .select('*')
        .order('checked_in_at', { ascending: false });

      if (error) throw error;
      setCheckins(data || []);
    } catch (error) {
      console.error('Error loading check-ins:', error);
      toast({
        title: "Error",
        description: "Failed to load check-in data.",
        variant: "destructive",
      });
    }
  }, [setupAdminContext, toast]);

  const isGuestCheckedIn = (guestName: string) => {
    const normalizedName = guestName.toLowerCase().trim();
    return checkins.some(checkin => 
      checkin.guest_name.toLowerCase().trim() === normalizedName && 
      !checkin.checked_out_at
    );
  };

  const handleCheckIn = async (guest: Guest) => {
    try {
      await setupAdminContext();
      
      const { error } = await supabase
        .from('guest_checkins')
        .insert({
          guest_name: guest.name,
          table_number: guest.tableNumber || 0,
          checked_in_by: 'admincode@modivc.com',
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${guest.name} has been checked in.`,
      });

      loadCheckins();
    } catch (error) {
      console.error('Error checking in guest:', error);
      toast({
        title: "Error",
        description: "Failed to check in guest.",
        variant: "destructive",
      });
    }
  };

  const handleCheckOut = async (guest: Guest) => {
    try {
      await setupAdminContext();
      
      const checkin = checkins.find(c => 
        c.guest_name.toLowerCase().trim() === guest.name.toLowerCase().trim() && 
        !c.checked_out_at
      );

      if (!checkin) return;

      const { error } = await supabase
        .from('guest_checkins')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('id', checkin.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${guest.name} has been checked out.`,
      });

      loadCheckins();
    } catch (error) {
      console.error('Error checking out guest:', error);
      toast({
        title: "Error",
        description: "Failed to check out guest.",
        variant: "destructive",
      });
    }
  };

  const getSeatPosition = (table: Table, seatIndex: number) => {
    const tableRadius = 40;
    const seatRadius = 8;
    const angle = (table.seats[seatIndex]?.angle || 0) * (Math.PI / 180);
    
    return {
      x: table.x + Math.cos(angle) * tableRadius - seatRadius,
      y: table.y + Math.sin(angle) * tableRadius - seatRadius,
    };
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await loadTables();
      setLoading(false);
    };
    
    initializeData();
  }, [loadTables]);

  useEffect(() => {
    if (tables.length > 0) {
      loadGuests();
      loadCheckins();
    }
  }, [tables, loadGuests, loadCheckins]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = guests.filter(guest =>
        guest.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
      );
      setFilteredGuests(filtered);
    } else {
      setFilteredGuests([]);
    }
  }, [searchTerm, guests]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading event check-in data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/tables')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Table Manager
              </Button>
              <h1 className="text-2xl font-bold">Event Day Check-In</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4">
        <div className="flex gap-6 h-[calc(100vh-120px)]">
          {/* Table Layout - Read Only */}
          <div className="flex-1">
            <div className="border rounded-lg p-4 h-full bg-card">
              <h2 className="text-lg font-semibold mb-4">Table Layout</h2>
              <div className="relative w-full h-full overflow-auto">
                <svg
                  viewBox="0 0 1200 800"
                  className="w-full h-full border-2 border-dashed border-muted-foreground/20"
                >
                  {tables.map((table) => (
                    <g key={table.id}>
                      {/* Table Circle */}
                      <circle
                        cx={table.x}
                        cy={table.y}
                        r={40}
                        fill="hsl(var(--muted))"
                        stroke="hsl(var(--border))"
                        strokeWidth={2}
                      />
                      
                      {/* Table Number */}
                      <text
                        x={table.x}
                        y={table.y + 5}
                        textAnchor="middle"
                        className="fill-foreground font-medium text-sm"
                      >
                        {table.number}
                      </text>
                      
                      {/* Seats */}
                      {table.seats.map((seat, seatIndex) => {
                        const seatPos = getSeatPosition(table, seatIndex);
                        const isCheckedIn = seat.guestName && isGuestCheckedIn(seat.guestName);
                        
                        return (
                          <g key={seatIndex}>
                            <circle
                              cx={seatPos.x + 8}
                              cy={seatPos.y + 8}
                              r={8}
                              fill={
                                isCheckedIn 
                                  ? "hsl(142, 76%, 36%)" // Green for checked in
                                  : seat.guestName 
                                    ? "hsl(var(--primary))" 
                                    : "hsl(var(--muted-foreground))"
                              }
                              stroke="hsl(var(--border))"
                              strokeWidth={1}
                            />
                            {seat.guestName && (
                              <text
                                x={seatPos.x + 8}
                                y={seatPos.y - 10}
                                textAnchor="middle"
                                className="fill-foreground text-xs font-medium"
                              >
                                {seat.guestName.split(' ').map(name => name[0]).join('')}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>

          {/* Check-In Panel */}
          <div className="w-96">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Guest Check-In
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search guest name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Separator />

                {/* Search Results */}
                <div className="flex-1 overflow-auto space-y-2">
                  {searchTerm.trim() && filteredGuests.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No guests found matching "{searchTerm}"
                    </p>
                  )}
                  
                  {filteredGuests.map((guest, index) => {
                    const isCheckedIn = isGuestCheckedIn(guest.name);
                    
                    return (
                      <Card key={index} className="p-3">
                        <div className="space-y-2">
                          <div>
                            <h3 className="font-medium">{guest.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {guest.tableNumber ? `Table ${guest.tableNumber}` : 'No table assigned'}
                            </p>
                          </div>
                          
                          <div className="flex gap-2">
                            {!isCheckedIn ? (
                              <Button
                                size="sm"
                                onClick={() => handleCheckIn(guest)}
                                className="flex-1"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Check In
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCheckOut(guest)}
                                className="flex-1"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Check Out
                              </Button>
                            )}
                          </div>
                          
                          {isCheckedIn && (
                            <p className="text-xs text-green-600 font-medium">
                              ✓ Checked In
                            </p>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Stats */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {checkins.filter(c => !c.checked_out_at).length}
                      </p>
                      <p className="text-xs text-muted-foreground">Checked In</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-muted-foreground">
                        {guests.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Guests</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCheckIn;