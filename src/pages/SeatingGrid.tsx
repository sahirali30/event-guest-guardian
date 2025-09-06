import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Users, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PasswordProtection from '@/components/PasswordProtection';

interface Seat {
  id: string;
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
  id: string;
  name: string;
  email: string;
  type: 'invited' | 'guest';
}

const SeatingGrid = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [unassignedGuests, setUnassignedGuests] = useState<Guest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Setup admin context
  const setupAdminContext = async (): Promise<boolean> => {
    try {
      await supabase.rpc('set_config', {
        setting_name: 'app.current_user_email',
        setting_value: 'admincode@modivc.com'
      });
      return true;
    } catch (error) {
      console.error('Failed to setup admin context:', error);
      return false;
    }
  };

  // Load tables and guests data
  useEffect(() => {
    const loadData = async () => {
      try {
        const contextSet = await setupAdminContext();
        if (!contextSet) {
          throw new Error('Failed to establish admin context');
        }

        // Load tables with seat assignments
        const { data: tableConfigs, error: tablesError } = await supabase
          .from('table_configurations')
          .select(`
            *,
            seat_assignments(*)
          `)
          .order('table_number', { ascending: true });

        if (tablesError) throw tablesError;

        // Transform table data
        const transformedTables = tableConfigs?.map(config => ({
          id: config.id,
          number: config.table_number,
          label: config.label,
          x: Number(config.x),
          y: Number(config.y),
          seats: Array.from({ length: config.seat_count }, (_, index) => {
            const assignment = config.seat_assignments?.find((sa: any) => sa.seat_index === index);
            return {
              id: assignment?.id || `${config.id}-seat-${index}`,
              angle: assignment?.seat_angle || (360 / config.seat_count) * index,
              guestName: assignment?.guest_name || undefined,
              tag: assignment?.tag || undefined,
              note: assignment?.note || undefined,
            };
          })
        })) || [];

        setTables(transformedTables);

        // Load all registered guests
        const { data: registrations, error: registrationsError } = await supabase
          .from('registrations')
          .select(`
            invited_guest_id,
            invited_guests!inner(name, email),
            guest_registrations(guest_name, guest_email)
          `)
          .eq('will_attend', true);

        if (registrationsError) throw registrationsError;

        // Combine invited guests and their additional guests
        const combinedGuests: Guest[] = [];
        
        registrations?.forEach((registration: any) => {
          // Add the main invited guest
          if (registration.invited_guests) {
            combinedGuests.push({
              id: registration.invited_guest_id,
              name: registration.invited_guests.name,
              email: registration.invited_guests.email,
              type: 'invited'
            });
          }
          
          // Add their registered guests
          registration.guest_registrations?.forEach((guest: any) => {
            if (guest.guest_name && !combinedGuests.some(g => g.name === guest.guest_name && g.email === guest.guest_email)) {
              combinedGuests.push({
                id: `guest-${guest.guest_email}`,
                name: guest.guest_name,
                email: guest.guest_email,
                type: 'guest'
              });
            }
          });
        });

        setGuests(combinedGuests);

        // Calculate unassigned guests
        const assignedGuestNames = transformedTables
          .flatMap(table => table.seats)
          .filter(seat => seat.guestName)
          .map(seat => seat.guestName);

        const unassigned = combinedGuests.filter(guest => 
          !assignedGuestNames.includes(guest.name)
        );

        setUnassignedGuests(unassigned);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredUnassignedGuests = unassignedGuests.filter(guest =>
    guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guest.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTableOccupancy = (table: Table) => {
    const assignedSeats = table.seats.filter(seat => seat.guestName).length;
    const totalSeats = table.seats.length;
    return { assigned: assignedSeats, total: totalSeats };
  };

  const getOccupancyColor = (assigned: number, total: number) => {
    const percentage = assigned / total;
    if (percentage === 1) return 'bg-emerald-500';
    if (percentage >= 0.5) return 'bg-yellow-500';
    if (percentage > 0) return 'bg-orange-500';
    return 'bg-muted';
  };

  if (loading) {
    return (
      <PasswordProtection>
        <div className="min-h-screen bg-background p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading seating data...</div>
          </div>
        </div>
      </PasswordProtection>
    );
  }

  return (
    <PasswordProtection>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/tables">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Table Manager
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">Table Seating Overview</h1>
                <p className="text-muted-foreground">
                  {tables.length} tables • {guests.length} total guests • {unassignedGuests.length} unassigned
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Main Content - Tables Grid */}
          <div className="flex-1 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tables.map((table) => {
                const { assigned, total } = getTableOccupancy(table);
                const assignedSeats = table.seats.filter(seat => seat.guestName);
                
                return (
                  <Card key={table.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{table.label}</CardTitle>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${getOccupancyColor(assigned, total)}`} />
                          <span className="text-sm text-muted-foreground">
                            {assigned}/{total}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {assignedSeats.length > 0 ? (
                        <div className="space-y-2">
                          {assignedSeats.map((seat, index) => (
                            <div key={seat.id} className="flex items-center justify-between">
                              <span className="text-sm font-medium">{seat.guestName}</span>
                              {seat.tag && (
                                <Badge variant="secondary" className="text-xs">
                                  {seat.tag}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No guests assigned</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Sidebar - Unassigned Guests */}
          <div className="w-80 border-l bg-card">
            <div className="sticky top-0 p-6 border-b bg-card">
              <h2 className="text-lg font-semibold mb-4">Unassigned Guests</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search guests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {filteredUnassignedGuests.length} of {unassignedGuests.length} unassigned
              </p>
            </div>
            
            <div className="p-6 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {filteredUnassignedGuests.length > 0 ? (
                filteredUnassignedGuests.map((guest) => (
                  <Card key={guest.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{guest.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{guest.email}</p>
                      </div>
                      <Badge variant={guest.type === 'invited' ? 'default' : 'secondary'} className="text-xs ml-2">
                        {guest.type === 'invited' ? 'Invited' : 'Guest'}
                      </Badge>
                    </div>
                  </Card>
                ))
              ) : searchQuery ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No guests found matching "{searchQuery}"</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">All guests have been assigned!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PasswordProtection>
  );
};

export default SeatingGrid;