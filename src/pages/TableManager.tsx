import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import PasswordProtection from '@/components/PasswordProtection';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Minus, Trash2, Download, Upload, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  selected?: boolean;
}

interface Guest {
  id: string;
  name: string;
  email: string;
  type: 'invited' | 'guest';
}

const TableManager = () => {
  const { toast: showToast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<{ tableId: string; seatId: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [draggedTable, setDraggedTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load tables from database or initialize default layout
  useEffect(() => {
    const loadTables = async () => {
      try {
        // Set admin context for table management access
        await supabase.rpc('set_config', {
          setting_name: 'app.current_user_email',
          setting_value: 'admincode@modivc.com' // This should be replaced with actual authentication
        });

        // First, try to load from database
        const { data: tableConfigs, error } = await supabase
          .from('table_configurations')
          .select(`
            *,
            seat_assignments(*)
          `)
          .order('table_number');

        if (!error && tableConfigs && tableConfigs.length > 0) {
          // Convert database data to table format
          const loadedTables: Table[] = tableConfigs.map(config => {
            // Create all seats based on seat_count
            const seats: Seat[] = [];
            for (let i = 0; i < config.seat_count; i++) {
              const assignment = config.seat_assignments.find((a: any) => a.seat_index === i);
              seats.push({
                id: `seat-${config.table_number}-${i}`,
                angle: (i * 360) / config.seat_count,
                guestName: assignment?.guest_name || undefined,
                tag: assignment?.tag || undefined,
                note: assignment?.note || undefined,
              });
            }
            
            return {
              id: `table-${config.table_number}`,
              number: config.table_number,
              label: config.label,
              x: Number(config.x),
              y: Number(config.y),
              seats
            };
          });
          setTables(loadedTables);
        } else {
          // Initialize default layout if no data in database
          initializeDefaultTables();
        }
      } catch (error) {
        console.error('Error loading tables:', error);
        // Fallback to localStorage
        const savedTables = localStorage.getItem('tableSeatLayout');
        if (savedTables) {
          setTables(JSON.parse(savedTables));
        } else {
          initializeDefaultTables();
        }
      }
    };

    const initializeDefaultTables = async () => {
      const initialTables: Table[] = [];
      const canvasWidth = 1200;
      const canvasHeight = 800;
      
      // Row 1: 10 tables
      for (let i = 0; i < 10; i++) {
        const x = (i + 1) * (canvasWidth / 11);
        const y = 150;
        initialTables.push(createTable(i + 1, x, y));
      }
      
      // Row 2: 10 tables
      for (let i = 0; i < 10; i++) {
        const x = (i + 1) * (canvasWidth / 11);
        const y = 350;
        initialTables.push(createTable(i + 11, x, y));
      }
      
      // Row 3: 4 tables
      for (let i = 0; i < 4; i++) {
        const x = (i + 1) * (canvasWidth / 5);
        const y = 550;
        initialTables.push(createTable(i + 21, x, y));
      }
      
      setTables(initialTables);
      // Save initial layout to database
      await saveTablesToDatabase(initialTables);
    };

    loadTables();
  }, []);

  // Load both invited guests and their registered guests from Supabase
  useEffect(() => {
    const loadGuests = async () => {
      try {
        // Set admin context for guest data access
        await supabase.rpc('set_config', {
          setting_name: 'app.current_user_email',
          setting_value: 'admincode@modivc.com'
        });

        const { data, error } = await supabase
        .from('registrations')
        .select(`
          invited_guest_id,
          invited_guests!inner(name, email),
          guest_registrations(guest_name, guest_email)
        `)
        .eq('will_attend', true);
      
      if (!error && data) {
        const combinedGuests: Guest[] = [];
        
        // Add invited guests
        data.forEach((registration: any) => {
          const invitedGuest = registration.invited_guests;
          if (invitedGuest && !combinedGuests.some(g => g.email === invitedGuest.email)) {
            combinedGuests.push({
              id: registration.invited_guest_id,
              name: invitedGuest.name,
              email: invitedGuest.email,
              type: 'invited'
            });
          }
          
          // Add their registered guests
          registration.guest_registrations?.forEach((guest: any) => {
            if (guest.guest_name && !combinedGuests.some(g => g.email === guest.guest_email)) {
              combinedGuests.push({
                id: `guest-${guest.guest_email}`,
                name: guest.guest_name,
                email: guest.guest_email,
                type: 'guest'
              });
            }
          });
        });
        
        // Sort guests by name
        combinedGuests.sort((a, b) => a.name.localeCompare(b.name));
        setGuests(combinedGuests);
      } else {
        console.error('Error loading guests:', error);
      }
    } catch (error) {
      console.error('Error loading guests:', error);
    }
    };
    loadGuests();
  }, []);

  // Keep localStorage as backup but database is primary
  useEffect(() => {
    if (tables.length > 0) {
      localStorage.setItem('tableSeatLayout', JSON.stringify(tables));
    }
  }, [tables]);

  // Database functions
  const saveTablesToDatabase = async (tablesToSave: Table[]) => {
    try {
      // Set admin context for table operations
      await supabase.rpc('set_config', {
        setting_name: 'app.current_user_email',
        setting_value: 'admincode@modivc.com'
      });

      // Clear existing data
      await supabase.from('table_configurations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Save table configurations
      for (const table of tablesToSave) {
        const { data: tableConfig, error: tableError } = await supabase
          .from('table_configurations')
          .insert({
            table_number: table.number,
            label: table.label,
            x: table.x,
            y: table.y,
            seat_count: table.seats.length
          })
          .select()
          .single();

        if (tableError) {
          console.error('Error saving table:', tableError);
          continue;
        }

        // Save seat assignments
        for (let i = 0; i < table.seats.length; i++) {
          const seat = table.seats[i];
          if (seat.guestName || seat.tag || seat.note) {
            await supabase
              .from('seat_assignments')
              .insert({
                table_configuration_id: tableConfig.id,
                seat_index: i,
                seat_angle: seat.angle,
                guest_name: seat.guestName || null,
                tag: seat.tag || null,
                note: seat.note || null
              });
          }
        }
      }
    } catch (error) {
      console.error('Error saving to database:', error);
    }
  };

  const saveTableToDatabase = async (table: Table) => {
    try {
      // Set admin context for table operations
      await supabase.rpc('set_config', {
        setting_name: 'app.current_user_email',
        setting_value: 'admincode@modivc.com'
      });

      // Check if table exists
      const { data: existingTable } = await supabase
        .from('table_configurations')
        .select('id')
        .eq('table_number', table.number)
        .single();

      let tableConfigId: string;

      if (existingTable) {
        // Update existing table
        const { data: updatedTable, error: updateError } = await supabase
          .from('table_configurations')
          .update({
            label: table.label,
            x: table.x,
            y: table.y,
            seat_count: table.seats.length
          })
          .eq('table_number', table.number)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating table:', updateError);
          return;
        }
        tableConfigId = updatedTable.id;
      } else {
        // Insert new table
        const { data: newTable, error: insertError } = await supabase
          .from('table_configurations')
          .insert({
            table_number: table.number,
            label: table.label,
            x: table.x,
            y: table.y,
            seat_count: table.seats.length
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting table:', insertError);
          return;
        }
        tableConfigId = newTable.id;
      }

      // Clear existing seat assignments for this table
      await supabase
        .from('seat_assignments')
        .delete()
        .eq('table_configuration_id', tableConfigId);

      // Save seat assignments
      for (let i = 0; i < table.seats.length; i++) {
        const seat = table.seats[i];
        await supabase
          .from('seat_assignments')
          .insert({
            table_configuration_id: tableConfigId,
            seat_index: i,
            seat_angle: seat.angle,
            guest_name: seat.guestName || null,
            tag: seat.tag || null,
            note: seat.note || null
          });
      }
    } catch (error) {
      console.error('Error saving table to database:', error);
      showToast({
        title: "Save Error", 
        description: `Failed to save table: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const createTable = (number: number, x: number, y: number): Table => {
    const seats: Seat[] = [];
    for (let i = 0; i < 10; i++) {
      seats.push({
        id: `seat-${number}-${i}`,
        angle: (i * 360) / 10,
      });
    }
    
    return {
      id: `table-${number}`,
      number,
      label: `Table ${number}`,
      x,
      y,
      seats,
    };
  };

  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingDragTable, setPendingDragTable] = useState<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    setSelectedTable(tableId);
    setPendingDragTable(tableId);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setDragStartPosition({ x: mouseX, y: mouseY });
      setDragOffset({
        x: mouseX / zoom - table.x,
        y: mouseY / zoom - table.y,
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if we should start dragging for a pending table
    if (pendingDragTable && !draggedTable && dragStartPosition) {
      const distance = Math.sqrt(
        Math.pow(mouseX - dragStartPosition.x, 2) + 
        Math.pow(mouseY - dragStartPosition.y, 2)
      );
      
      // Start dragging if mouse moved more than 5 pixels
      if (distance > 5) {
        setDraggedTable(pendingDragTable);
      }
    }

    // Continue dragging if already dragging
    if (draggedTable) {
      const newX = mouseX / zoom - dragOffset.x;
      const newY = mouseY / zoom - dragOffset.y;

      setTables(prev => prev.map(table => 
        table.id === draggedTable 
          ? { ...table, x: Math.max(50, Math.min(1150, newX)), y: Math.max(50, Math.min(750, newY)) }
          : table
      ));
    }
  }, [draggedTable, pendingDragTable, dragStartPosition, dragOffset, zoom]);

  const handleMouseUp = useCallback(async () => {
    if (draggedTable) {
      const draggedTableData = tables.find(t => t.id === draggedTable);
      if (draggedTableData) {
        await saveTableToDatabase(draggedTableData);
      }
    }
    setDraggedTable(null);
    setPendingDragTable(null);
    setDragStartPosition(null);
  }, [draggedTable, tables]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const addSeat = async (tableId: string) => {
    const updatedTables = tables.map(table => {
      if (table.id === tableId && table.seats.length < 14) {
        const newSeats = [...table.seats];
        const newSeatId = `seat-${table.number}-${newSeats.length}`;
        newSeats.push({
          id: newSeatId,
          angle: (newSeats.length * 360) / (newSeats.length + 1),
        });
        
        // Redistribute angles
        newSeats.forEach((seat, index) => {
          seat.angle = (index * 360) / newSeats.length;
        });
        
        return { ...table, seats: newSeats };
      }
      return table;
    });
    
    setTables(updatedTables);
    
    // Save to database
    const updatedTable = updatedTables.find(t => t.id === tableId);
    if (updatedTable) {
      await saveTableToDatabase(updatedTable);
    }
  };

  const removeSeat = async (tableId: string) => {
    const updatedTables = tables.map(table => {
      if (table.id === tableId && table.seats.length > 1) {
        const newSeats = table.seats.slice(0, -1);
        
        // Redistribute angles
        newSeats.forEach((seat, index) => {
          seat.angle = (index * 360) / newSeats.length;
        });
        
        return { ...table, seats: newSeats };
      }
      return table;
    });
    
    setTables(updatedTables);
    
    // Save to database
    const updatedTable = updatedTables.find(t => t.id === tableId);
    if (updatedTable) {
      await saveTableToDatabase(updatedTable);
    }
  };

  const addTable = async () => {
    const maxNumber = Math.max(...tables.map(t => t.number));
    const newTable = createTable(maxNumber + 1, 600, 400);
    const updatedTables = [...tables, newTable];
    setTables(updatedTables);
    
    // Save to database
    await saveTableToDatabase(newTable);
    toast.success('Table added');
  };

  const deleteTable = async (tableId: string) => {
    const tableToDelete = tables.find(t => t.id === tableId);
    if (tableToDelete) {
      try {
        // Set admin context for table operations
        await supabase.rpc('set_config', {
          setting_name: 'app.current_user_email',
          setting_value: 'admincode@modivc.com'
        });

        // Delete from database
        await supabase
          .from('table_configurations')
          .delete()
          .eq('table_number', tableToDelete.number);
      } catch (error) {
        console.error('Error deleting table:', error);
      }
    }
    
    setTables(prev => prev.filter(t => t.id !== tableId));
    setSelectedTable(null);
    toast.success('Table deleted');
  };

  const assignSeat = async (tableId: string, seatId: string, guestName: string, tag?: string, note?: string) => {
    const updatedTables = tables.map(table => {
      if (table.id === tableId) {
        return {
          ...table,
          seats: table.seats.map(seat => 
            seat.id === seatId 
              ? { ...seat, guestName, tag, note }
              : seat
          )
        };
      }
      return table;
    });
    
    setTables(updatedTables);
    
    // Save to database
    const updatedTable = updatedTables.find(t => t.id === tableId);
    if (updatedTable) {
      await saveTableToDatabase(updatedTable);
    }
    
    setSelectedSeat(null);
    toast.success('Seat assigned');
  };

  const searchGuest = (query: string) => {
    const foundSeat = tables.find(table => 
      table.seats.some(seat => 
        seat.guestName?.toLowerCase().includes(query.toLowerCase())
      )
    );
    
    if (foundSeat) {
      setSelectedTable(foundSeat.id);
      // Center view on the table
      if (canvasRef.current) {
        canvasRef.current.scrollTo({
          left: foundSeat.x * zoom - canvasRef.current.clientWidth / 2,
          top: foundSeat.y * zoom - canvasRef.current.clientHeight / 2,
          behavior: 'smooth'
        });
      }
    }
  };

  const exportLayout = () => {
    const dataStr = JSON.stringify(tables, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'table-layout.json';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Layout exported');
  };

  const importLayout = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          setTables(imported);
          
          // Save imported layout to database
          await saveTablesToDatabase(imported);
          toast.success('Layout imported');
        } catch {
          toast.error('Invalid file format');
        }
      };
      reader.readAsText(file);
    }
  };

  const getSeatPosition = (table: Table, seat: Seat) => {
    const radius = 60;
    const angleRad = (seat.angle * Math.PI) / 180;
    return {
      x: table.x + radius * Math.cos(angleRad),
      y: table.y + radius * Math.sin(angleRad),
    };
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const selectedTableData = selectedTable ? tables.find(t => t.id === selectedTable) : null;

  return (
    <PasswordProtection>
      <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Table Seating Manager</h1>
            <div className="flex items-center gap-2">
              <Button onClick={addTable} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Table
              </Button>
              <Button onClick={exportLayout} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={importLayout}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search guest name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchGuest(searchQuery)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                variant="outline"
                size="sm"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                variant="outline"
                size="sm"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setZoom(1)}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-140px)]">
        <div className="flex-1 overflow-auto" ref={canvasRef}>
          <div 
            className="relative bg-muted/20"
            style={{
              width: '1200px',
              height: '800px',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            {tables.map((table) => (
              <div key={table.id} className="absolute">
                {/* Table */}
                <div
                  className={`absolute w-20 h-20 rounded-full border-2 cursor-move flex items-center justify-center text-xs font-medium ${
                    selectedTable === table.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/50'
                  }`}
                  style={{
                    left: table.x - 40,
                    top: table.y - 40,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, table.id)}
                >
                  {table.number}
                </div>
                
                {/* Seats */}
                {table.seats.map((seat) => {
                  const pos = getSeatPosition(table, seat);
                  return (
                    <Dialog key={seat.id}>
                      <DialogTrigger asChild>
                        <div
                          className={`absolute w-8 h-8 rounded-full border-2 cursor-pointer flex items-center justify-center text-xs ${
                            seat.guestName
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground bg-background hover:border-primary'
                          }`}
                          style={{
                            left: pos.x - 16,
                            top: pos.y - 16,
                          }}
                          title={seat.guestName || 'Empty seat'}
                        >
                          {seat.guestName ? getInitials(seat.guestName) : ''}
                        </div>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Seat - Table {table.number}</DialogTitle>
                        </DialogHeader>
                        <SeatAssignmentForm
                          seat={seat}
                          guests={guests}
                          onAssign={(guestName, tag, note) =>
                            assignSeat(table.id, seat.id, guestName, tag, note)
                          }
                        />
                      </DialogContent>
                    </Dialog>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {selectedTableData && (
          <Card className="w-80 m-4">
            <CardHeader>
              <CardTitle>Table {selectedTableData.number}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => removeSeat(selectedTableData.id)}
                  variant="outline"
                  size="sm"
                  disabled={selectedTableData.seats.length <= 1}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  {selectedTableData.seats.length} seats
                </span>
                <Button
                  onClick={() => addSeat(selectedTableData.id)}
                  variant="outline"
                  size="sm"
                  disabled={selectedTableData.seats.length >= 14}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Assigned Guests:</h4>
                {selectedTableData.seats
                  .filter(seat => seat.guestName)
                  .map(seat => (
                    <div key={seat.id} className="flex items-center justify-between text-sm">
                      <span>{seat.guestName}</span>
                      {seat.tag && <Badge variant="secondary">{seat.tag}</Badge>}
                    </div>
                  ))}
                {selectedTableData.seats.every(seat => !seat.guestName) && (
                  <p className="text-sm text-muted-foreground">No guests assigned</p>
                )}
              </div>
              
              <Button
                onClick={() => deleteTable(selectedTableData.id)}
                variant="destructive"
                size="sm"
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Table
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Modi Ventures Logo Footer */}
      <div className="border-t bg-card mt-8">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-4">
              <img src="/lovable-uploads/41378f9d-db71-4814-8ea0-835eac6a7179.png" alt="Modi Ventures Logo" className="h-8 w-auto" />
              <span className="text-lg font-medium tracking-wider text-foreground">MODI VENTURES</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PasswordProtection>
  );
};

const SeatAssignmentForm = ({
  seat,
  guests,
  onAssign,
}: {
  seat: Seat;
  guests: Guest[];
  onAssign: (guestName: string, tag?: string, note?: string) => void;
}) => {
  const [selectedGuest, setSelectedGuest] = useState(seat.guestName || '');
  const [customName, setCustomName] = useState('');
  const [tag, setTag] = useState(seat.tag || '');
  const [note, setNote] = useState(seat.note || '');
  const [useCustomName, setUseCustomName] = useState(false);

  const handleSubmit = () => {
    const guestName = useCustomName ? customName : selectedGuest;
    if (guestName.trim()) {
      onAssign(guestName.trim(), tag.trim() || undefined, note.trim() || undefined);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Guest</label>
        <div className="space-y-2">
          <Select
            value={useCustomName ? '' : selectedGuest}
            onValueChange={(value) => {
              setSelectedGuest(value);
              setUseCustomName(false);
            }}
            disabled={useCustomName}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a registered guest" />
            </SelectTrigger>
            <SelectContent>
              {guests.map((guest) => (
                <SelectItem key={guest.id} value={guest.name}>
                  {guest.name} {guest.type === 'guest' && '(Guest)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="custom-name"
              checked={useCustomName}
              onChange={(e) => setUseCustomName(e.target.checked)}
            />
            <label htmlFor="custom-name" className="text-sm">Use custom name</label>
          </div>
          
          {useCustomName && (
            <Input
              placeholder="Enter custom guest name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tag (optional)</label>
        <Input
          placeholder="e.g., VIP, Speaker"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Note (optional)</label>
        <Textarea
          placeholder="Additional notes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSubmit} className="flex-1">
          Assign Seat
        </Button>
        {seat.guestName && (
          <Button
            onClick={() => onAssign('', '', '')}
            variant="outline"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};

export default TableManager;