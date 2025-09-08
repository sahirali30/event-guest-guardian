import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Search, Check, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import hallFloorPlan from '@/assets/hall-floor-plan.png';
import modiLogo from '@/assets/modi-logo.svg';

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
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [zoom, setZoom] = useState(1);
  const [processingGuest, setProcessingGuest] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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
      
      // Only load guests who are registered to attend (will_attend = true)
      const { data: registrations, error: registrationsError } = await supabase
        .from('registrations')
        .select(`
          invited_guest_id,
          invited_guests!inner(name, email),
          guest_registrations(guest_name, guest_email)
        `)
        .eq('will_attend', true);

      if (registrationsError) throw registrationsError;

      const combinedGuests: Guest[] = [];
      
      // Add invited guests who are attending
      registrations?.forEach((registration: any) => {
        const invitedGuest = registration.invited_guests;
        if (invitedGuest && !combinedGuests.some(g => g.email === invitedGuest.email)) {
          combinedGuests.push({
            name: invitedGuest.name.trim(),
            email: invitedGuest.email,
          });
        }
        
        // Add their registered guests
        registration.guest_registrations?.forEach((guest: any) => {
          if (guest.guest_name && !combinedGuests.some(g => g.name === guest.guest_name && g.email === guest.guest_email)) {
            combinedGuests.push({
              name: guest.guest_name.trim(),
              email: guest.guest_email || undefined,
            });
          }
        });
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
    // Validate guest is not already checked in
    if (isGuestCheckedIn(guest.name)) {
      toast({
        title: "Already Checked In",
        description: `${guest.name} is already checked in.`,
        variant: "destructive",
      });
      return;
    }

    // Validate table assignment if required
    if (!guest.tableNumber) {
      toast({
        title: "No Table Assigned",
        description: `${guest.name} does not have a table assignment. Please assign a table first.`,
        variant: "destructive",
      });
      return;
    }

    setProcessingGuest(guest.name);
    
    try {
      console.log('Starting check-in process for guest:', guest.name, 'Table:', guest.tableNumber);
      
      await setupAdminContext();
      console.log('Admin context setup completed');
      
      const checkInData = {
        guest_name: guest.name.trim(),
        table_number: guest.tableNumber,
        checked_in_by: 'admincode@modivc.com',
      };
      
      console.log('Inserting check-in data:', checkInData);
      
      const { error } = await supabase
        .from('guest_checkins')
        .insert(checkInData);

      if (error) {
        console.error('Supabase error during check-in:', error);
        throw error;
      }

      console.log('Check-in successful for:', guest.name);

      toast({
        title: "Success",
        description: `${guest.name} has been checked in to Table ${guest.tableNumber}.`,
      });

      await loadCheckins();
    } catch (error: any) {
      console.error('Error checking in guest:', error);
      
      let errorMessage = "Failed to check in guest.";
      if (error?.message?.includes('duplicate')) {
        errorMessage = "Guest is already checked in.";
      } else if (error?.message?.includes('table_number')) {
        errorMessage = "Invalid table number assignment.";
      } else if (error?.code) {
        errorMessage = `Database error (${error.code}): ${error.message}`;
      }
      
      toast({
        title: "Check-In Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessingGuest(null);
    }
  };

  const handleCheckOut = async (guest: Guest) => {
    setProcessingGuest(guest.name);
    
    try {
      console.log('Starting check-out process for guest:', guest.name);
      
      await setupAdminContext();
      console.log('Admin context setup completed for check-out');
      
      const checkin = checkins.find(c => 
        c.guest_name.toLowerCase().trim() === guest.name.toLowerCase().trim() && 
        !c.checked_out_at
      );

      if (!checkin) {
        console.log('No active check-in found for guest:', guest.name);
        toast({
          title: "Not Checked In",
          description: `${guest.name} is not currently checked in.`,
          variant: "destructive",
        });
        return;
      }

      console.log('Updating check-out for checkin ID:', checkin.id);

      const { error } = await supabase
        .from('guest_checkins')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('id', checkin.id);

      if (error) {
        console.error('Supabase error during check-out:', error);
        throw error;
      }

      console.log('Check-out successful for:', guest.name);

      toast({
        title: "Success",
        description: `${guest.name} has been checked out.`,
      });

      await loadCheckins();
    } catch (error: any) {
      console.error('Error checking out guest:', error);
      
      let errorMessage = "Failed to check out guest.";
      if (error?.code) {
        errorMessage = `Database error (${error.code}): ${error.message}`;
      }
      
      toast({
        title: "Check-Out Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessingGuest(null);
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

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
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

  const tableGuests = selectedTable
    ? guests.filter(guest => guest.tableNumber === selectedTable.number)
    : [];

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
            
            {/* Zoom Controls */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground self-center min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetZoom}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4">
        <div className="flex h-[calc(100vh-140px)]">
          {/* Table Layout */}
          <div className="flex-1 overflow-auto" ref={canvasRef}>
            <div 
              className="relative bg-muted/20"
              style={{
                width: '2000px',
                height: '1400px',
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                backgroundImage: 'url("/lovable-uploads/a3f76216-9fc3-4634-8419-d4cbdbef2e73.png")',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }}
            >
              {tables.map((table) => (
                <div key={table.id} className="absolute">
                  {/* Table */}
                  <div
                    className={`absolute w-20 h-20 rounded-full border-2 cursor-pointer flex items-center justify-center text-xs font-medium hover:border-primary/50 ${
                      selectedTable?.id === table.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-foreground'
                    }`}
                    style={{
                      left: table.x - 40,
                      top: table.y - 40,
                    }}
                    onClick={() => handleTableClick(table)}
                  >
                    <div className="text-center">
                      <div className="font-bold">{table.number}</div>
                      <div className="text-[10px] text-muted-foreground leading-none">{table.label}</div>
                    </div>
                  </div>
                  
                  {/* Seats */}
                  {table.seats.map((seat, seatIndex) => {
                    const seatPos = getSeatPosition(table, seatIndex);
                    const isCheckedIn = seat.guestName && isGuestCheckedIn(seat.guestName);
                    
                    return (
                      <div
                        key={seatIndex}
                        className={`absolute w-6 h-6 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                          isCheckedIn 
                            ? 'bg-green-600 border-green-700 text-white' // Green for checked in
                            : seat.guestName 
                              ? 'bg-primary border-primary-foreground text-primary-foreground' 
                              : 'bg-muted border-muted-foreground text-muted-foreground'
                        }`}
                        style={{
                          left: seatPos.x,
                          top: seatPos.y,
                        }}
                        title={seat.guestName || 'Empty seat'}
                      >
                        {isCheckedIn ? '✓' : seat.guestName ? seat.guestName.split(' ').map(name => name[0]).join('') : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Check-In Panel */}
          <div className="w-[600px]">
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
                            <p className={`text-sm ${guest.tableNumber ? 'text-muted-foreground' : 'text-red-500 font-semibold'}`}>
                              {guest.tableNumber ? `Table ${guest.tableNumber}` : 'No table assigned'}
                            </p>
                          </div>
                          
                          <div className="flex gap-2">
                            {!isCheckedIn ? (
                              <Button
                                size="sm"
                                onClick={() => handleCheckIn(guest)}
                                className="flex-1"
                                disabled={processingGuest === guest.name || !guest.tableNumber}
                              >
                                {processingGuest === guest.name ? (
                                  <div className="w-4 h-4 mr-1 animate-spin rounded-full border-2 border-b-transparent border-current" />
                                ) : (
                                  <Check className="w-4 h-4 mr-1" />
                                )}
                                {processingGuest === guest.name ? 'Processing...' : 'Check In'}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCheckOut(guest)}
                                className="flex-1"
                                disabled={processingGuest === guest.name}
                              >
                                {processingGuest === guest.name ? (
                                  <div className="w-4 h-4 mr-1 animate-spin rounded-full border-2 border-b-transparent border-current" />
                                ) : (
                                  <X className="w-4 h-4 mr-1" />
                                )}
                                {processingGuest === guest.name ? 'Processing...' : 'Check Out'}
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


      {/* Table Guests Dialog */}
      <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Table {selectedTable?.number} - {selectedTable?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-auto">
            {tableGuests.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No guests assigned to this table
              </p>
            ) : (
              tableGuests.map((guest, index) => {
                const isCheckedIn = isGuestCheckedIn(guest.name);
                return (
                  <Card key={index} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{guest.name}</h4>
                        {guest.email && (
                          <p className="text-sm text-muted-foreground">{guest.email}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {isCheckedIn ? (
                          <span className="text-green-600 font-medium text-sm">✓ Checked In</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not checked in</span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventCheckIn;