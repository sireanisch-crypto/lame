const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database'); // Import the Supabase client

// The password for sensitive operations
const STOCK_PASSWORD = process.env.STOCK_PASSWORD || '2255';

// Middleware to check the password for POST/DELETE requests
const checkPassword = (req, res, next) => {
    const { password } = req.body;
    if (password !== STOCK_PASSWORD) {
        return res.status(403).json({ error: 'Incorrect password' });
    }
    next();
};

// GET /api/data - Fetch all data from all tables
router.get('/data', async (req, res) => {
    try {
        const { data: inventory, error: invError } = await supabase.from('inventory').select('*');
        const { data: logs, error: logError } = await supabase.from('logs').select('*').order('created_at', { ascending: false });
        const { data: machineBlades, error: mbError } = await supabase.from('machineBlades').select('*');
        const { data: bladeAssignments, error: baError } = await supabase.from('bladeAssignments').select('*');
        const { data: machineStatus, error: msError } = await supabase.from('machineStatus').select('*');

        if (invError || logError || mbError || baError || msError) {
            console.error('Supabase fetch error:', { invError, logError, mbError, baError, msError });
            return res.status(500).json({ error: 'Failed to fetch data from Supabase' });
        }

        // Transform the flat inventory data back to the nested format the frontend expects
        const nestedInventory = {};
        inventory.forEach(item => {
            if (!nestedInventory[item.group_name]) {
                nestedInventory[item.group_name] = {};
            }
            nestedInventory[item.group_name][item.blade_type] = {
                fixed: item.fixed,
                available: item.available
            };
        });

        // Transform bladeAssignments and machineStatus into objects
        const bladeAssignmentsObj = bladeAssignments.reduce((acc, item) => {
            acc[item.machine_id] = { type: item.blade_type, count: item.count };
            return acc;
        }, {});

        const machineStatusObj = machineStatus.reduce((acc, item) => {
            acc[item.machine_id] = item.status;
            return acc;
        }, {});
        
        const machineBladesObj = machineBlades.reduce((acc, item) => {
            acc[item.machine_id] = item.blade_type;
            return acc;
        }, {});


        res.json({
            inventory: nestedInventory,
            logs: logs,
            machineBlades: machineBladesObj,
            bladeAssignments: bladeAssignmentsObj,
            machineStatus: machineStatusObj
        });

    } catch (error) {
        console.error('Server error in /api/data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/inventory - Update inventory stock
router.post('/inventory', checkPassword, async (req, res) => {
    const { group_name, blade_type, fixed, available } = req.body;
    try {
        const { error } = await supabase
            .from('inventory')
            .upsert({ group_name, blade_type, fixed, available }, { onConflict: 'group_name, blade_type' });

        if (error) throw error;
        res.status(200).json({ message: 'Inventory updated successfully' });
    } catch (error) {
        console.error('Error updating inventory:', error);
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});

// POST /api/logs - Add a new log entry
router.post('/logs', checkPassword, async (req, res) => {
    const { machine_name, blade_type, action, amount, person_name, group_name } = req.body;
    try {
        const { error } = await supabase
            .from('logs')
            .insert({ machine_name, blade_type, action, amount, person_name, group_name });

        if (error) throw error;
        res.status(201).json({ message: 'Log entry added successfully' });
    } catch (error) {
        console.error('Error adding log entry:', error);
        res.status(500).json({ error: 'Failed to add log entry' });
    }
});

// DELETE /api/logs/:id - Delete a log entry
router.delete('/logs/:id', checkPassword, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('logs').delete().eq('id', id);

        if (error) throw error;
        res.status(200).json({ message: 'Log entry deleted successfully' });
    } catch (error) {
        console.error('Error deleting log entry:', error);
        res.status(500).json({ error: 'Failed to delete log entry' });
    }
});

// POST /api/machine-blades - Update machine blade
router.post('/machine-blades', checkPassword, async (req, res) => {
    const { machine_id, blade_type } = req.body;
    try {
        const { error } = await supabase
            .from('machineBlades')
            .upsert({ machine_id, blade_type }, { onConflict: 'machine_id' });

        if (error) throw error;
        res.status(200).json({ message: 'Machine blade updated successfully' });
    } catch (error) {
        console.error('Error updating machine blade:', error);
        res.status(500).json({ error: 'Failed to update machine blade' });
    }
});

// POST /api/blade-assignments - Update blade assignment
router.post('/blade-assignments', checkPassword, async (req, res) => {
    const { machine_id, blade_type, count } = req.body;
    try {
        const { error } = await supabase
            .from('bladeAssignments')
            .upsert({ machine_id, blade_type, count }, { onConflict: 'machine_id' });

        if (error) throw error;
        res.status(200).json({ message: 'Blade assignment updated successfully' });
    } catch (error) {
        console.error('Error updating blade assignment:', error);
        res.status(500).json({ error: 'Failed to update blade assignment' });
    }
});

// POST /api/machine-status - Update machine status
router.post('/machine-status', checkPassword, async (req, res) => {
    const { machine_id, status } = req.body;
    try {
        const { error } = await supabase
            .from('machineStatus')
            .upsert({ machine_id, status }, { onConflict: 'machine_id' });

        if (error) throw error;
        res.status(200).json({ message: 'Machine status updated successfully' });
    } catch (error) {
        console.error('Error updating machine status:', error);
        res.status(500).json({ error: 'Failed to update machine status' });
    }
});

// POST /api/reset - Reset all data
router.post('/reset', checkPassword, async (req, res) => {
    try {
        // Delete all rows from each table
        const { error: invError } = await supabase.from('inventory').delete().neq('group_name', 'impossible_value');
        const { error: logError } = await supabase.from('logs').delete().neq('id', -1);
        const { error: mbError } = await supabase.from('machineBlades').delete().neq('machine_id', 'impossible_value');
        const { error: baError } = await supabase.from('bladeAssignments').delete().neq('machine_id', 'impossible_value');
        const { error: msError } = await supabase.from('machineStatus').delete().neq('machine_id', 'impossible_value');

        if (invError || logError || mbError || baError || msError) {
            console.error('Supabase reset error:', { invError, logError, mbError, baError, msError });
            throw new Error('Failed to reset one or more tables.');
        }

        res.status(200).json({ message: 'All data reset successfully' });
    } catch (error) {
        console.error('Error resetting data:', error);
        res.status(500).json({ error: 'Failed to reset data' });
    }
});


module.exports = router;