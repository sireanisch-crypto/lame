const express = require('express');
const router = express.Router();
const db = require('../database'); // This now imports the Supabase client
const { verifyStockPassword } = require('../middleware/auth');

// Get all data
router.get('/data', async (req, res) => {
  try {
    // Use Supabase client to fetch data from all tables at once
    const { data: inventoryData, error: inventoryError } = await db.supabase
      .from('inventory')
      .select('*');
    
    const { data: logsData, error: logsError } = await db.supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false });
    
    const { data: bladesData, error: bladesError } = await db.supabase
      .from('machine_blades')
      .select('*');
    
    const { data: assignmentsData, error: assignmentsError } = await db.supabase
      .from('blade_assignments')
      .select('*');
    
    const { data: statusData, error: statusError } = await db.supabase
      .from('machine_status')
      .select('*');

    // Check for any errors
    if (inventoryError || logsError || bladesError || assignmentsError || statusError) {
      console.error('Error fetching data from Supabase:', inventoryError || logsError || bladesError || assignmentsError || statusError);
      throw new Error('Failed to fetch data from Supabase');
    }

    // Transform inventory data to match frontend structure
    const inventory = {};
    if (inventoryData.data) {
      inventoryData.data.forEach(item => {
        if (!inventory[item.group_name]) {
          inventory[item.group_name] = {};
        }
        inventory[item.group_name][item.blade_type] = {
          fixed: item.fixed || 0,
          available: item.available || 0
        };
      });
    }
    
    // Transform machine blades data
    const machineBlades = {};
    if (bladesData.data) {
      bladesData.data.forEach(item => {
        machineBlades[item.machine_id] = item.blade_type;
      });
    }
    
    // Transform blade assignments data
    const bladeAssignments = {};
    if (assignmentsData.data) {
      assignmentsData.data.forEach(item => {
        bladeAssignments[item.machine_id] = {
          type: item.blade_type,
          count: item.count || 0
        };
      });
    }
    
    // Transform machine status data
    const machineStatus = {};
    if (statusData.data) {
      statusData.data.forEach(item => {
        machineStatus[item.machine_id] = item.status;
      });
    }
    
    // Transform logs data
    const logs = logsData.data ? logsData.data : [];
    
    res.json({
      inventory,
      logs,
      machineBlades,
      bladeAssignments,
      machineStatus
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update inventory
router.post('/inventory', verifyStockPassword, async (req, res) => {
  try {
    const { group_name, blade_type, fixed, available } = req.body;
    
    const { data, error } = await db.supabase
      .from('inventory')
      .upsert({
        group_name,
        blade_type,
        fixed,
        available
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error updating inventory:', error);
      throw new Error('Failed to update inventory');
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add log entry
router.post('/logs', verifyStockPassword, async (req, res) => {
  try {
    const { machine_name, blade_type, action, amount, person_name, group_name } = req.body;
    
    const { data, error } = await db.supabase
      .from('logs')
      .insert({
        machine_name,
        blade_type,
        action,
        amount,
        person_name,
        group_name,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding log entry:', error);
      throw new Error('Failed to add log entry');
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error adding log entry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update machine blade
router.post('/machine-blades', verifyStockPassword, async (req, res) => {
  try {
    const { machine_id, blade_type } = req.body;
    
    const { data, error } = await db.supabase
      .from('machine_blades')
      .upsert({
        machine_id,
        blade_type
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error updating machine blade:', error);
      throw new Error('Failed to update machine blade');
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating machine blade:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update blade assignment
router.post('/blade-assignments', verifyStockPassword, async (req, res) => {
  try {
    const { machine_id, blade_type, count } = req.body;
    
    const { data, error } = await db.supabase
      .from('blade_assignments')
      .upsert({
        machine_id,
        blade_type,
        count
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error updating blade assignment:', error);
      throw new Error('Failed to update blade assignment');
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating blade assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update machine status
router.post('/machine-status', verifyStockPassword, async (req, res) => {
  try {
    const { machine_id, status } = req.body;
    
    const { data, error } = await db.supabase
      .from('machine_status')
      .upsert({
        machine_id,
        status
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error updating machine status:', error);
      throw new Error('Failed to update machine status');
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating machine status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete log entry
router.delete('/logs/:id', verifyStockPassword, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await db.supabase
      .from('logs')
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error deleting log entry:', error);
      throw new Error('Failed to delete log entry');
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error deleting log entry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset all data
router.post('/reset', verifyStockPassword, async (req, res) => {
  try {
    // Delete all data from all tables
    await db.supabase.from('blade_assignments').delete().neq('machine_id', '');
    await db.supabase.from('machine_blades').delete().neq('machine_id', '');
    await db.supabase.from('machine_status').delete().neq('machine_id', '');
    await db.supabase.from('logs').delete().neq('machine_id', '');
    
    // Reset inventory to zero
    const { data: inventoryData } = await db.supabase
      .from('inventory')
      .select('*');
    
    if (inventoryData.data) {
      for (const item of inventoryData.data) {
        await db.supabase
          .from('inventory')
          .update({ fixed: 0, available: 0 })
          .eq('group_name', item.group_name)
          .eq('blade_type', item.blade_type);
      }
    }
    
    res.json({ message: 'All data has been reset successfully' });
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;