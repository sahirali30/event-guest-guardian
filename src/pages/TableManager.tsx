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
import { Search, Plus, Minus, Trash2, Download, Upload, ZoomIn, ZoomOut, RotateCcw, AlertCircle, CheckCircle, X, Grid3X3, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Simple admin context setup
  const setupAdminContext = async (): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('set_config', {
        setting_name: 'app.current_user_email',
        setting_value: 'admincode@modivc.com'
      });

      if (error) {
        console.error('Failed to set admin context:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Admin context setup failed:', error);
      return false;
    }
  };

  // Load tables from database or initialize default layout
  useEffect(() => {
    const loadTables = async () => {
      try {
        const contextSet = await setupAdminContext();
        if (!contextSet) {
          throw new Error('Failed to establish admin context');
        }

        const { data: tableConfigs, error } = await supabase
          .from('table_configurations')
          .select(`
            *,
            seat_assignments(*)
          `)
          .order('table_number');

        if (!error && tableConfigs && tableConfigs.length > 0) {
          const loadedTables: Table[] = tableConfigs.map(config => {
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
              x: config.x,
              y: config.y,
              seats,
            };
          });
          
          setTables(loadedTables);
          toast("Layout Loaded", { description: "Table layout loaded from database." });
        } else {
          // Initialize with default layout
          const defaultTables = createDefaultLayout();
          setTables(defaultTables);
        }
      } catch (error) {
        console.error('Error loading tables:', error);
        const defaultTables = createDefaultLayout();
        setTables(defaultTables);
        toast("Using Default Layout", { description: "Could not load saved layout. Using default." });
      }
    };

    loadTables();
  }, []);

  // Load guests
  useEffect(() => {
    const loadGuests = async () => {
      try {
        const contextSet = await setupAdminContext();
        if (!contextSet) return;

        const [invitedGuestsResponse, registrationsResponse] = await Promise.all([
          supabase.from('invited_guests').select('id, name, email'),
          supabase.from('registrations').select(`
            id,
            invited_guest_id,
            guest_registrations(guest_name, guest_email)
          `)
        ]);

        const allGuests: Guest[] = [];

        if (invitedGuestsResponse.data) {
          allGuests.push(...invitedGuestsResponse.data.map(guest => ({
            id: guest.id,
            name: guest.name,
            email: guest.email,
            type: 'invited' as const
          })));
        }

        if (registrationsResponse.data) {
          registrationsResponse.data.forEach(registration => {
            if (registration.guest_registrations) {
              registration.guest_registrations.forEach((guest: any) => {
                allGuests.push({
                  id: `guest-${Date.now()}-${Math.random()}`,
                  name: guest.guest_name,
                  email: guest.guest_email || '',
                  type: 'guest' as const
                });
              });
            }
          });
        }

        setGuests(allGuests);
      } catch (error) {
        console.error('Error loading guests:', error);
      }
    };

    loadGuests();
  }, []);

  const createDefaultLayout = (): Table[] => {
    return Array.from({ length: 20 }, (_, i) => {
      const tableNumber = i + 1;
      const angle = (i * 18) * (Math.PI / 180);
      const radius = 200;
      const centerX = 400;
      const centerY = 300;
      
      return createTable(
        tableNumber,
        `Table ${tableNumber}`,
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
        10
      );
    });
  };

  const createTable = (number: number, label: string, x: number, y: number, seatCount: number = 10): Table => {
    const seats: Seat[] = Array.from({ length: seatCount }, (_, i) => ({
      id: `seat-${number}-${i}`,
      angle: (i * 360) / seatCount,
    }));

    return {
      id: `table-${number}`,
      number,
      label,
      x,
      y,
      seats,
    };
  };

  // Simple seat assignment update
  const updateSeatAssignments = async (table: Table): Promise<void> => {
    try {
      const contextSet = await setupAdminContext();
      if (!contextSet) throw new Error('Failed to establish admin context');

      // Get the table configuration ID
      const { data: tableConfig } = await supabase
        .from('table_configurations')
        .select('id')
        .eq('table_number', table.number)
        .single();

      if (!tableConfig) throw new Error('Table configuration not found');

      // Delete existing seat assignments for this table
      await supabase
        .from('seat_assignments')
        .delete()
        .eq('table_configuration_id', tableConfig.id);

      // Insert new seat assignments (only for seats with assignments)
      const seatAssignments = table.seats
        .map((seat, index) => ({
          table_configuration_id: tableConfig.id,
          seat_index: index,
          seat_angle: seat.angle,
          guest_name: seat.guestName || null,
          tag: seat.tag || null,
          note: seat.note || null
        }))
        .filter(assignment => assignment.guest_name || assignment.tag || assignment.note);

      if (seatAssignments.length > 0) {
        const { error: insertError } = await supabase
          .from('seat_assignments')
          .insert(seatAssignments);

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error updating seat assignments:', error);
      throw error;
    }
  };

  const saveTablesToDatabase = async (): Promise<void> => {
    try {
      setSaveStatus('saving');
      const contextSet = await setupAdminContext();
      if (!contextSet) throw new Error('Failed to establish admin context');

      for (const table of tables) {
        await saveTableToDatabase(table);
      }

      setSaveStatus('saved');
      toast("Layout Saved", { description: "All tables and seating assignments saved successfully." });
      
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving tables:', error);
      setSaveStatus('error');
      toast("Save Failed", { description: "Failed to save layout. Please try again." });
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const saveTableToDatabase = async (table: Table): Promise<void> => {
    try {
      const contextSet = await setupAdminContext();
      if (!contextSet) throw new Error('Failed to establish admin context');

      const tableData = {
        table_number: table.number,
        label: table.label,
        x: table.x,
        y: table.y,
        seat_count: table.seats.length
      };

      const { error } = await supabase
        .from('table_configurations')
        .upsert(tableData, { onConflict: 'table_number' });

      if (error) throw error;
      await updateSeatAssignments(table);
    } catch (error) {
      console.error('Error saving table:', error);
      throw error;
    }
  };

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveTablesToDatabase();
    }, 1000);
  }, [tables]);

  const addSeat = (tableId: string) => {
    setTables(prevTables => {
      const newTables = prevTables.map(table => {
        if (table.id === tableId) {
          const newSeatIndex = table.seats.length;
          const newSeat: Seat = {
            id: `seat-${table.number}-${newSeatIndex}`,
            angle: (newSeatIndex * 360) / (table.seats.length + 1),
          };
          
          const updatedSeats = [...table.seats, newSeat].map((seat, index) => ({
            ...seat,
            angle: (index * 360) / (table.seats.length + 1)
          }));
          
          const updatedTable = { ...table, seats: updatedSeats };
          saveTableToDatabase(updatedTable).catch(console.error);
          return updatedTable;
        }
        return table;
      });
      return newTables;
    });
  };

  const removeSeat = (tableId: string) => {
    setTables(prevTables => {
      const newTables = prevTables.map(table => {
        if (table.id === tableId && table.seats.length > 1) {
          const updatedSeats = table.seats.slice(0, -1).map((seat, index) => ({
            ...seat,
            angle: (index * 360) / (table.seats.length - 1)
          }));
          
          const updatedTable = { ...table, seats: updatedSeats };
          saveTableToDatabase(updatedTable).catch(console.error);
          return updatedTable;
        }
        return table;
      });
      return newTables;
    });
  };

  const addTable = () => {
    const maxTableNumber = Math.max(...tables.map(t => t.number), 0);
    const newTable = createTable(
      maxTableNumber + 1,
      `Table ${maxTableNumber + 1}`,
      400 + Math.random() * 200 - 100,
      300 + Math.random() * 200 - 100
    );
    
    setTables(prev => [...prev, newTable]);
    saveTableToDatabase(newTable).catch(console.error);
  };

  const deleteTable = (tableId: string) => {
    setTables(prev => {
      const newTables = prev.filter(t => t.id !== tableId);
      const tableNumber = parseInt(tableId.split('-')[1]);
      
      // Delete from database
      setupAdminContext().then(async () => {
        try {
          const { data: tableConfig } = await supabase
            .from('table_configurations')
            .select('id')
            .eq('table_number', tableNumber)
            .single();

          if (tableConfig) {
            await supabase.from('seat_assignments').delete().eq('table_configuration_id', tableConfig.id);
            await supabase.from('table_configurations').delete().eq('id', tableConfig.id);
          }
        } catch (error) {
          console.error('Error deleting table from database:', error);
        }
      });
      
      return newTables;
    });
    
    if (selectedTable === tableId) {
      setSelectedTable(null);
      setSelectedSeat(null);
    }
  };

  const assignSeat = async (tableId: string, seatId: string, guestName: string, tag: string, note: string) => {
    try {
      setTables(prevTables => {
        const newTables = prevTables.map(table => {
          if (table.id === tableId) {
            const updatedSeats = table.seats.map(seat => {
              if (seat.id === seatId) {
                return {
                  ...seat,
                  guestName: guestName || undefined,
                  tag: tag || undefined,
                  note: note || undefined
                };
              }
              return seat;
            });
            
            const updatedTable = { ...table, seats: updatedSeats };
            saveTableToDatabase(updatedTable).catch(console.error);
            return updatedTable;
          }
          return table;
        });
        return newTables;
      });

      toast("Seat Assigned", { description: `Seat assigned to ${guestName || 'guest'}.` });
    } catch (error) {
      console.error('Error assigning seat:', error);
      toast("Assignment Failed", { description: "Failed to assign seat. Please try again." });
    }
  };

  const resetToDefault = async () => {
    try {
      setSaveStatus('saving');
      const contextSet = await setupAdminContext();
      if (!contextSet) throw new Error('Failed to establish admin context');

      // Clear all data from database
      await supabase.from('seat_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('table_configurations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Reset to default layout
      const defaultTables = createDefaultLayout();
      setTables(defaultTables);
      
      // Save default layout to database
      for (const table of defaultTables) {
        await saveTableToDatabase(table);
      }

      setSelectedTable(null);
      setSelectedSeat(null);
      setSaveStatus('saved');
      toast("Reset Complete", { description: "Layout reset to default and saved." });
      
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error resetting layout:', error);
      setSaveStatus('error');
      toast("Reset Failed", { description: "Failed to reset layout. Please try again." });
      setTimeout(() => setSaveStatus('idle'), 3000);
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
    toast("Layout Exported", { description: "Table layout exported successfully." });
  };

  const importLayout = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setTables(imported);
        saveTablesToDatabase();
        toast("Layout Imported", { description: "Table layout imported and saved successfully." });
      } catch (error) {
        toast("Import Failed", { description: "Invalid file format." });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const exportSeatingCSV = () => {
    const csvData = [];
    csvData.push(['Table Number', 'Table Label', 'Seat Number', 'Guest Name', 'Tag', 'Note']);
    
    tables.forEach(table => {
      table.seats.forEach((seat, index) => {
        if (seat.guestName) {
          csvData.push([
            table.number.toString(),
            table.label,
            (index + 1).toString(),
            seat.guestName,
            seat.tag || '',
            seat.note || ''
          ]);
        }
      });
    });

    const csvContent = csvData.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'seating-assignments.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast("Seating List Exported", { description: "Seating assignments exported to CSV." });
  };

  // Drag and drop functionality
  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDraggedTable(tableId);
    
    const table = tables.find(t => t.id === tableId);
    if (table && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      setDragOffset({
        x: x - table.x,
        y: y - table.y
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent, tableId: string) => {
    e.preventDefault();
    setDraggedTable(tableId);
    
    const table = tables.find(t => t.id === tableId);
    if (table && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const x = (touch.clientX - rect.left) / zoom;
      const y = (touch.clientY - rect.top) / zoom;
      setDragOffset({
        x: x - table.x,
        y: y - table.y
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedTable || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - dragOffset.x;
    const y = (e.clientY - rect.top) / zoom - dragOffset.y;
    
    setTables(prev => prev.map(table => 
      table.id === draggedTable 
        ? { ...table, x: Math.max(0, Math.min(800, x)), y: Math.max(0, Math.min(600, y)) }
        : table
    ));
  }, [draggedTable, dragOffset, zoom]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!draggedTable || !canvasRef.current) return;
    e.preventDefault();
    
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / zoom - dragOffset.x;
    const y = (touch.clientY - rect.top) / zoom - dragOffset.y;
    
    setTables(prev => prev.map(table => 
      table.id === draggedTable 
        ? { ...table, x: Math.max(0, Math.min(800, x)), y: Math.max(0, Math.min(600, y)) }
        : table
    ));
  }, [draggedTable, dragOffset, zoom]);

  const handleMouseUp = useCallback(() => {
    if (draggedTable) {
      debouncedSave();
      setDraggedTable(null);
    }
  }, [draggedTable, debouncedSave]);

  const handleTouchEnd = useCallback(() => {
    if (draggedTable) {
      debouncedSave();
      setDraggedTable(null);
    }
  }, [draggedTable, debouncedSave]);

  useEffect(() => {
    if (draggedTable) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [draggedTable, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const filteredGuests = guests.filter(guest =>
    guest.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTableData = tables.find(t => t.id === selectedTable);
  const selectedSeatData = selectedSeat && selectedTableData?.seats.find(s => s.id === selectedSeat.seatId);

  return (
    <PasswordProtection>
      <div className="min-h-screen bg-background p-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Table Manager</h1>
            <p className="text-muted-foreground">Arrange tables and assign guests to seats</p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Save Status Indicator */}
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                <span>Saving...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Saved</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Save Failed</span>
              </div>
            )}
            
            <Link to="/seating-grid">
              <Button variant="outline" size="sm">
                <Grid3X3 className="w-4 h-4 mr-2" />
                Grid View
              </Button>
            </Link>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={addTable} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Table
          </Button>
          
          <Button onClick={exportLayout} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Layout
          </Button>
          
          <Button variant="outline" size="sm" asChild>
            <label>
              <Upload className="w-4 h-4 mr-2" />
              Import Layout
              <input type="file" accept=".json" onChange={importLayout} className="hidden" />
            </label>
          </Button>
          
          <Button onClick={exportSeatingCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Seating
          </Button>
          
          <Button onClick={resetToDefault} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
        </div>

        {/* Search and Zoom Controls */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search guests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Canvas */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-4">
                <div 
                  ref={canvasRef}
                  className="relative w-full h-[600px] bg-muted/20 rounded-lg border-2 border-dashed border-muted overflow-hidden"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                >
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      className={`absolute cursor-move ${
                        selectedTable === table.id ? 'ring-2 ring-primary' : ''
                      }`}
                      style={{
                        left: table.x - 40,
                        top: table.y - 40,
                        width: 80,
                        height: 80,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, table.id)}
                      onTouchStart={(e) => handleTouchStart(e, table.id)}
                      onClick={() => setSelectedTable(table.id)}
                    >
                      {/* Table */}
                      <div className="w-20 h-20 bg-background border-2 border-primary rounded-full flex items-center justify-center relative">
                        <div className="text-center">
                          <div className="font-semibold text-sm">{table.number}</div>
                          <div className="text-xs text-muted-foreground">{table.seats.length} seats</div>
                        </div>
                        
                        {/* Seats */}
                        {table.seats.map((seat, index) => {
                          const seatAngle = (seat.angle * Math.PI) / 180;
                          const seatRadius = 45;
                          const seatX = Math.cos(seatAngle) * seatRadius;
                          const seatY = Math.sin(seatAngle) * seatRadius;
                          
                          return (
                            <div
                              key={seat.id}
                              className={`absolute w-3 h-3 rounded-full border cursor-pointer ${
                                seat.guestName
                                  ? 'bg-green-500 border-green-600'
                                  : 'bg-background border-muted-foreground'
                              } ${
                                selectedSeat?.seatId === seat.id
                                  ? 'ring-2 ring-primary'
                                  : ''
                              }`}
                              style={{
                                left: `calc(50% + ${seatX}px - 6px)`,
                                top: `calc(50% + ${seatY}px - 6px)`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTable(table.id);
                                setSelectedSeat({ tableId: table.id, seatId: seat.id });
                              }}
                              title={seat.guestName || `Seat ${index + 1}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {selectedTableData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Table {selectedTableData.number}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTable(selectedTableData.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Label</label>
                    <Input
                      value={selectedTableData.label}
                      onChange={(e) => {
                        const newLabel = e.target.value;
                        setTables(prev => prev.map(table => 
                          table.id === selectedTableData.id 
                            ? { ...table, label: newLabel }
                            : table
                        ));
                        debouncedSave();
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Seats: {selectedTableData.seats.length}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeSeat(selectedTableData.id)}
                        disabled={selectedTableData.seats.length <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addSeat(selectedTableData.id)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Seat Assignments</label>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {selectedTableData.seats.map((seat, index) => (
                        <div
                          key={seat.id}
                          className={`p-2 rounded-md border cursor-pointer ${
                            selectedSeat?.seatId === seat.id
                              ? 'border-primary bg-primary/10'
                              : 'border-muted'
                          }`}
                          onClick={() => setSelectedSeat({ tableId: selectedTableData.id, seatId: seat.id })}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Seat {index + 1}</span>
                            {seat.guestName && (
                              <Badge variant="secondary" className="text-xs">
                                {seat.guestName}
                              </Badge>
                            )}
                          </div>
                          {seat.tag && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Tag: {seat.tag}
                            </div>
                          )}
                          {seat.note && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Note: {seat.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedSeatData && (
                    <div className="border-t pt-4">
                      <SeatAssignmentForm
                        seat={selectedSeatData}
                        guests={filteredGuests}
                        onAssign={(guestName, tag, note) => 
                          assignSeat(selectedTableData.id, selectedSeatData.id, guestName, tag, note)
                        }
                        allTables={tables}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PasswordProtection>
  );
};

// Seat Assignment Form Component
interface SeatAssignmentFormProps {
  seat: Seat;
  guests: Guest[];
  onAssign: (guestName: string, tag: string, note: string) => void;
  allTables: Table[];
}

const SeatAssignmentForm: React.FC<SeatAssignmentFormProps> = ({ seat, guests, onAssign, allTables }) => {
  const [selectedGuest, setSelectedGuest] = useState(seat.guestName || '');
  const [useCustomName, setUseCustomName] = useState(!guests.find(g => g.name === seat.guestName));
  const [customName, setCustomName] = useState(seat.guestName || '');
  const [tag, setTag] = useState(seat.tag || '');
  const [note, setNote] = useState(seat.note || '');

  const handleSubmit = () => {
    const guestName = useCustomName ? customName.trim() : selectedGuest;
    onAssign(guestName, tag, note);
  };

  // Check for duplicate assignments
  const assignedGuestNames = new Set<string>();
  allTables.forEach(table => {
    table.seats.forEach(seatItem => {
      if (seatItem.guestName && seatItem.id !== seat.id) {
        assignedGuestNames.add(seatItem.guestName.toLowerCase().trim());
      }
    });
  });

  const currentGuestName = useCustomName ? customName.trim() : selectedGuest;
  const isDuplicate = currentGuestName && assignedGuestNames.has(currentGuestName.toLowerCase().trim());

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Assign Guest</h4>
      
      <div className="space-y-3">
        <div className="space-y-2">
          <Select value={selectedGuest} onValueChange={setSelectedGuest} disabled={useCustomName}>
            <SelectTrigger>
              <SelectValue placeholder="Select a guest" />
            </SelectTrigger>
            <SelectContent>
              {guests.map((guest) => (
                <SelectItem key={guest.id} value={guest.name}>
                  <div className="flex items-center gap-2">
                    <span>{guest.name}</span>
                    <Badge variant={guest.type === 'invited' ? 'default' : 'secondary'} className="text-xs">
                      {guest.type}
                    </Badge>
                  </div>
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

      {isDuplicate && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>This guest is already assigned to another seat</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button 
          onClick={handleSubmit} 
          className="flex-1"
          disabled={isDuplicate}
        >
          Assign Seat
        </Button>
        {seat.guestName && (
          <Button
            onClick={() => {
              onAssign('', '', '');
              toast("Seat Cleared", { description: "The seat assignment has been removed." });
            }}
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