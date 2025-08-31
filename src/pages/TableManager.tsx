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
import { Search, Plus, Minus, Trash2, Download, Upload, ZoomIn, ZoomOut, RotateCcw, AlertCircle, CheckCircle, X } from 'lucide-react';
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
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced admin context setup with retry logic
  const setupAdminContext = async (retries = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await supabase.rpc('set_config', {
          setting_name: 'app.current_user_email',
          setting_value: 'admincode@modivc.com'
        });
        
        // Verify the context was set by attempting a simple query
        const { error: testError } = await supabase
          .from('table_configurations')
          .select('id')
          .limit(1);
          
        if (!testError) {
          return true;
        }
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      } catch (error) {
        console.error(`Admin context setup attempt ${attempt} failed:`, error);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    }
    return false;
  };

  // Load tables from database or initialize default layout
  useEffect(() => {
    const loadTables = async () => {
      try {
        // Setup admin context with retry logic
        const contextSet = await setupAdminContext();
        if (!contextSet) {
          throw new Error('Failed to establish admin context');
        }

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
      const canvasWidth = 2000;  // Expanded from 1200 to 2000
      const canvasHeight = 1400; // Expanded from 800 to 1400
      const margin = 150;        // Added margin around edges
      
      // Ensure we always have complete set of tables 1-24
      // Row 1: Tables 1-10 with improved spacing
      for (let i = 1; i <= 10; i++) {
        const x = margin + (i - 1) * ((canvasWidth - 2 * margin) / 9);
        const y = 250;  // Moved down from 150 to give top margin
        initialTables.push(createTable(i, x, y));
      }
      
      // Row 2: Tables 11-20 with improved spacing 
      for (let i = 11; i <= 20; i++) {
        const x = margin + (i - 11) * ((canvasWidth - 2 * margin) / 9);
        const y = 650;  // Increased spacing from 350 to 650 (400px gap between rows)
        initialTables.push(createTable(i, x, y));
      }
      
      // Row 3: Tables 21-24 with improved spacing
      for (let i = 21; i <= 24; i++) {
        const x = margin + (canvasWidth - 2 * margin) / 4 * (i - 21) + (canvasWidth - 2 * margin) / 8;
        const y = 1050; // Increased spacing from 550 to 1050 (400px gap)
        initialTables.push(createTable(i, x, y));
      }
      
      setTables(initialTables);
      // Save complete layout to database
      await saveTablesToDatabase(initialTables);
    };

    loadTables();
  }, []);

  // Load both invited guests and their registered guests from Supabase
  useEffect(() => {
    const loadGuests = async () => {
      try {
        // Setup admin context for guest data access
        const contextSet = await setupAdminContext();
        if (!contextSet) {
          console.error('Failed to establish admin context for guest loading');
          return;
        }

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

  // Enhanced database save with retry logic and error handling
  const saveTablesToDatabase = async (tablesToSave: Table[], retries = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        setSaveStatus('saving');
        
        // Setup admin context with retry logic
        const contextSet = await setupAdminContext();
        if (!contextSet) {
          throw new Error('Failed to establish admin context');
        }

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
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return true;
    } catch (error) {
      console.error(`Save attempt ${attempt} failed:`, error);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
        showToast({
          title: "Save Failed",
          description: `Failed to save tables after ${retries} attempts: ${error.message}`,
          variant: "destructive"
        });
        return false;
      }
    }
    }
    return false;
  };

  // Debounced save with retry logic for individual tables
  const saveTableToDatabase = async (table: Table, retries = 3): Promise<boolean> => {
    const tableKey = `table-${table.number}`;
    setPendingSaves(prev => new Set(prev).add(tableKey));
    
    console.log(`Attempting to save table ${table.number} (attempt 1/${retries})`);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        setSaveStatus('saving');
        
        console.log(`Save attempt ${attempt} for table ${table.number}: Setting up admin context...`);
        
        // Setup admin context with retry logic
        const contextSet = await setupAdminContext();
        if (!contextSet) {
          throw new Error('Failed to establish admin context after retries');
        }

        console.log(`Admin context established for table ${table.number}`);

        // Check if table exists (get most recent if multiple exist)
        console.log(`Checking if table ${table.number} exists in database...`);
        const { data: existingTable, error: selectError } = await supabase
          .from('table_configurations')
          .select('id')
          .eq('table_number', table.number)
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (selectError) {
          console.error(`Error checking existing table ${table.number}:`, selectError);
          throw selectError;
        }

        console.log(`Table ${table.number} existing check result:`, existingTable);

        let tableConfigId: string;

        if (existingTable) {
          console.log(`Updating existing table ${table.number} with ID ${existingTable.id}`);
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
            .maybeSingle();

          if (updateError) {
            console.error(`Error updating table ${table.number}:`, updateError);
            throw updateError;
          }
          
          // Handle case where update returns 0 rows (PGRST116 error)
          if (!updatedTable) {
            console.log(`Update returned 0 rows for table ${table.number}, attempting insert instead`);
            // Fall through to insert logic
          } else {
            tableConfigId = updatedTable.id;
            console.log(`Table ${table.number} updated successfully with ID ${tableConfigId}`);
          }
        }
        
        if (!existingTable || !tableConfigId) {
          console.log(`Inserting new table ${table.number}`);
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
            console.error(`Error inserting table ${table.number}:`, insertError);
            throw insertError;
          }
          tableConfigId = newTable.id;
          console.log(`Table ${table.number} inserted successfully with ID ${tableConfigId}`);
        }

        // Clear existing seat assignments for this table
        console.log(`Clearing existing seat assignments for table ${table.number} (ID: ${tableConfigId})`);
        const { error: deleteError } = await supabase
          .from('seat_assignments')
          .delete()
          .eq('table_configuration_id', tableConfigId);

        if (deleteError) {
          console.error(`Error clearing seat assignments for table ${table.number}:`, deleteError);
          throw deleteError;
        }

        // Save seat assignments
        console.log(`Saving seat assignments for table ${table.number}...`);
        const seatsWithData = table.seats.filter(seat => seat.guestName || seat.tag || seat.note);
        console.log(`Found ${seatsWithData.length} seats with data to save for table ${table.number}`);
        
        for (let i = 0; i < table.seats.length; i++) {
          const seat = table.seats[i];
          if (seat.guestName || seat.tag || seat.note) {
            console.log(`Saving seat ${i} for table ${table.number}:`, { guestName: seat.guestName, tag: seat.tag, note: seat.note });
            const { error: seatError } = await supabase
              .from('seat_assignments')
              .insert({
                table_configuration_id: tableConfigId,
                seat_index: i,
                seat_angle: seat.angle,
                guest_name: seat.guestName || null,
                tag: seat.tag || null,
                note: seat.note || null
              });
              
            if (seatError) {
              console.error(`Error saving seat ${i} for table ${table.number}:`, seatError);
              throw seatError;
            }
          }
        }
        
        console.log(`Successfully saved table ${table.number} and all seat assignments`);
        
        setPendingSaves(prev => {
          const newSet = new Set(prev);
          newSet.delete(tableKey);
          return newSet;
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        return true;
      } catch (error: any) {
        console.error(`Save table ${table.number} attempt ${attempt} failed:`, error);
        console.error('Error details:', error.message, error.code, error.details);
        
        if (attempt < retries) {
          console.log(`Retrying save for table ${table.number} in ${200 * attempt}ms...`);
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        } else {
          console.error(`All ${retries} save attempts failed for table ${table.number}`);
          setPendingSaves(prev => {
            const newSet = new Set(prev);
            newSet.delete(tableKey);
            return newSet;
          });
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 3000);
          showToast({
            title: "Save Error", 
            description: `Failed to save table ${table.number} after ${retries} attempts: ${error.message || 'Unknown error'}`,
            variant: "destructive"
          });
          return false;
        }
      }
    }
    return false;
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

  // Helper function to extract coordinates from mouse or touch events
  const getEventCoordinates = (e: MouseEvent | TouchEvent) => {
    if ('touches' in e) {
      return {
        clientX: e.touches[0]?.clientX || 0,
        clientY: e.touches[0]?.clientY || 0
      };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

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

  const handleTouchStart = (e: React.TouchEvent, tableId: string) => {
    e.preventDefault(); // Prevent scrolling and other default touch behaviors
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    setSelectedTable(tableId);
    setPendingDragTable(tableId);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && e.touches[0]) {
      const touchX = e.touches[0].clientX - rect.left;
      const touchY = e.touches[0].clientY - rect.top;
      setDragStartPosition({ x: touchX, y: touchY });
      setDragOffset({
        x: touchX / zoom - table.x,
        y: touchY / zoom - table.y,
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const coordinates = getEventCoordinates(e);
    const mouseX = coordinates.clientX - rect.left;
    const mouseY = coordinates.clientY - rect.top;

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
          ? { ...table, x: Math.max(50, Math.min(1950, newX)), y: Math.max(50, Math.min(1350, newY)) }
          : table
      ));
    }
  }, [draggedTable, pendingDragTable, dragStartPosition, dragOffset, zoom]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const coordinates = getEventCoordinates(e);
    const touchX = coordinates.clientX - rect.left;
    const touchY = coordinates.clientY - rect.top;

    // Check if we should start dragging for a pending table
    if (pendingDragTable && !draggedTable && dragStartPosition) {
      const distance = Math.sqrt(
        Math.pow(touchX - dragStartPosition.x, 2) + 
        Math.pow(touchY - dragStartPosition.y, 2)
      );
      
      // Start dragging if touch moved more than 5 pixels
      if (distance > 5) {
        setDraggedTable(pendingDragTable);
        e.preventDefault(); // Only prevent scrolling when starting drag
      }
    }

    // Continue dragging if already dragging
    if (draggedTable) {
      e.preventDefault(); // Only prevent scrolling during active drag
      const newX = touchX / zoom - dragOffset.x;
      const newY = touchY / zoom - dragOffset.y;

      setTables(prev => prev.map(table => 
        table.id === draggedTable 
          ? { ...table, x: Math.max(50, Math.min(1950, newX)), y: Math.max(50, Math.min(1350, newY)) }
          : table
      ));
    }
  }, [draggedTable, pendingDragTable, dragStartPosition, dragOffset, zoom]);

  // Debounced save for drag operations
  const debouncedSave = useCallback((table: Table) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      await saveTableToDatabase(table);
    }, 500); // Wait 500ms after drag stops before saving
  }, []);

  const handleMouseUp = useCallback(async () => {
    if (draggedTable) {
      const draggedTableData = tables.find(t => t.id === draggedTable);
      if (draggedTableData) {
        // Use debounced save to avoid rapid saves during drag
        debouncedSave(draggedTableData);
      }
    }
    setDraggedTable(null);
    setPendingDragTable(null);
    setDragStartPosition(null);
  }, [draggedTable, tables, debouncedSave]);

  const handleTouchEnd = useCallback(async () => {
    if (draggedTable) {
      const draggedTableData = tables.find(t => t.id === draggedTable);
      if (draggedTableData) {
        // Use debounced save to avoid rapid saves during drag
        debouncedSave(draggedTableData);
      }
    }
    setDraggedTable(null);
    setPendingDragTable(null);
    setDragStartPosition(null);
  }, [draggedTable, tables, debouncedSave]);

  useEffect(() => {
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
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

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
        // Setup admin context with retry logic
        const contextSet = await setupAdminContext();
        if (!contextSet) {
          throw new Error('Failed to establish admin context');
        }

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
    console.log('assignSeat called with:', { tableId, seatId, guestName, tag, note });
    
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
    
    console.log('Updated tables:', updatedTables);
    setTables(updatedTables);
    
    // Save to database
    const updatedTable = updatedTables.find(t => t.id === tableId);
    console.log('Found updated table for saving:', updatedTable);
    
    if (updatedTable) {
      console.log('Starting save to database...');
      try {
        const success = await saveTableToDatabase(updatedTable);
        if (success) {
          console.log('Save completed successfully');
          toast.success('Seat assigned and saved');
        } else {
          console.error('Save failed');
          toast.error('Failed to save seat assignment');
        }
      } catch (error) {
        console.error('Error during save:', error);
        toast.error('Error saving seat assignment');
      }
    } else {
      console.error('Could not find updated table for saving');
      toast.error('Could not find table to save');
    }
    
    setSelectedSeat(null);
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

  const resetToDefault = async () => {
    try {
      setSaveStatus('saving');
      
      // Create complete default layout (tables 1-24) with expanded dimensions
      const defaultTables: Table[] = [];
      const canvasWidth = 2000;  // Expanded dimensions
      const canvasHeight = 1400;
      const margin = 150;
      
      // Row 1: Tables 1-10 with improved spacing
      for (let i = 1; i <= 10; i++) {
        const x = margin + (i - 1) * ((canvasWidth - 2 * margin) / 9);
        const y = 250;
        defaultTables.push(createTable(i, x, y));
      }
      
      // Row 2: Tables 11-20 with improved spacing
      for (let i = 11; i <= 20; i++) {
        const x = margin + (i - 11) * ((canvasWidth - 2 * margin) / 9);
        const y = 650;
        defaultTables.push(createTable(i, x, y));
      }
      
      // Row 3: Tables 21-24 with improved spacing
      for (let i = 21; i <= 24; i++) {
        const x = margin + (canvasWidth - 2 * margin) / 4 * (i - 21) + (canvasWidth - 2 * margin) / 8;
        const y = 1050;
        defaultTables.push(createTable(i, x, y));
      }
      
      setTables(defaultTables);
      
      // Save all default tables to database
      await saveTablesToDatabase(defaultTables);
      
      showToast({
        title: "Tables Reset",
        description: "All tables restored to default layout (1-24)",
      });
    } catch (error) {
      console.error('Failed to reset tables:', error);
      setSaveStatus('error');
      showToast({
        title: "Reset Failed",
        description: "Failed to reset tables to default layout",
        variant: "destructive"
      });
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
              {/* Save Status Indicator */}
              <div className="flex items-center gap-1 text-xs">
                {saveStatus === 'saving' && (
                  <>
                    <div className="animate-spin w-3 h-3 border border-primary border-t-transparent rounded-full" />
                    <span className="text-muted-foreground">Saving...</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-green-500">Saved</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    <span className="text-red-500">Save failed</span>
                  </>
                )}
                {pendingSaves.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({pendingSaves.size} pending)
                  </span>
                )}
              </div>
              
              <Button onClick={resetToDefault} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Tables
              </Button>
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
                  onTouchStart={(e) => handleTouchStart(e, table.id)}
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
              <div className="flex items-center justify-between">
                <CardTitle>Table {selectedTableData.number}</CardTitle>
                <Button
                  onClick={() => setSelectedTable(null)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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