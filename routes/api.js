const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database'); // Import the Supabase client

// --- Middleware ---
const verifyStockPassword = (req, res, next) => {
    const { password } = req.body;
    if (password !== process.env.STOCK_PASSWORD) {
        return res.status(403).json({ message: 'Incorrect password' });
    }
    req.body.password = undefined;
    next();
};

// --- API Routes ---

// GET /api/data - Fetch all data from all tables
router.get('/data', async (req, res) => {
    try {
        const [
            { data: inventory, error: invError },
            { data: logs, error: logError },
            { data: machineBlades, error: mbError },
            { data: bladeAssignments, error: baError },
            { data: machineStatus, error: msError }
        ] = await Promise.all([
            supabase.from('inventory').select('*'),
            supabase.from('logs').select('*').order('created_at', { ascending: false }),
            supabase.from('machine_blades').select('*'),      // CORRECTED
            supabase.from('blade_assignments').select('*'),  // CORRECTED
            supabase.from('machine_status').select('*')      // CORRECTED
        ]);

        if (invError || logError || mbError || baError || msError) {
            console.error('Supabase fetch error:', { invError, logError, mbError, baError, msError });
            return res.status(500).json({ message: 'Failed to fetch data from database' });
        }

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

        const machineBladesObj = {};
        machineBlades.forEach(item => {
            machineBladesObj[item.machine_id] = item.blade_type;
        });

        const bladeAssignmentsObj = {};
        bladeAssignments.forEach(item => {
            bladeAssignmentsObj[item.machine_id] = {
                type: item.blade_type,
                count: item.count
            };
        });

        const machineStatusObj = {};
        machineStatus.forEach(item => {
            machineStatusObj[item.machine_id] = item.status;
        });

        res.json({
            inventory: nestedInventory,
            logs: logs,
            machineBlades: machineBladesObj,
            bladeAssignments: bladeAssignmentsObj,
            machineStatus: machineStatusObj
        });

    } catch (error) {
        console.error('Server error in /api/data:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/inventory - Update inventory stock
router.post('/inventory', verifyStockPassword, async (req, res) => {
    try {
        const { group_name, blade_type, fixed, available } = req.body;
        const { error } = await supabase
            .from('inventory')
            .upsert({ group_name, blade_type, fixed, available }, { onConflict: 'group_name, blade_type' });
        if (error) throw error;
        res.status(200).json({ message: 'Inventory updated successfully' });
    } catch (error) {
        console.error('Error updating inventory:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/logs - Add a new log entry
router.post('/logs', verifyStockPassword, async (req, res) => {
    try {
        const { machine_name, blade_type, action, amount, person_name, group_name } = req.body;
        const { error } = await supabase
            .from('logs')
            .insert({ machine_name, blade_type, action, amount, person_name, group_name });
        if (error) throw error;
        res.status(201).json({ message: 'Log entry added successfully' });
    } catch (error) {
        console.error('Error adding log entry:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/machine-blades - Update machine blade
router.post('/machine-blades', verifyStockPassword, async (req, res) => {
    try {
        const { machine_id, blade_type } = req.body;
        // The .select('*') was incorrectly placed here. It has been removed.
        const { error } = await supabase
            .from('machine_blades')
            .upsert({ machine_id, blade_type }, { onConflict: 'machine_id' });

        if (error) throw error;
        res.status(200).json({ message: 'Machine blade updated successfully' });
    } catch (error) {
        console.error('Error updating machine blade:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/blade-assignments - Update blade assignment
router.post('/blade-assignments', verifyStockPassword, async (req, res) => {
    try {
        const { machine_id, blade_type, count } = req.body;
        // The .select('*') was incorrectly placed here. It has been removed.
        const { error } = await supabase
            .from('blade_assignments')
            .upsert({ machine_id, blade_type, count }, { onConflict: 'machine_id' });

        if (error) throw error;
        res.status(200).json({ message: 'Blade assignment updated successfully' });
    } catch (error) {
        console.error('Error updating blade assignment:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/machine-status - Update machine status
router.post('/machine-status', verifyStockPassword, async (req, res) => {
    try {
        const { machine_id, status } = req.body;
        // The .select('*') was incorrectly placed here. It has been removed.
        const { error } = await supabase
            .from('machine_status')
            .upsert({ machine_id, status }, { onConflict: 'machine_id' });
        if (error) throw error;
        res.status(200).json({ message: 'Machine status updated successfully' });
    } catch (error) {
        console.error('Error updating machine status:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/logs/:id - Delete a log entry
router.delete('/logs/:id', verifyStockPassword, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('logs')
            .delete()
            .eq('id', id);
        if (error) throw error;
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Log entry not found' });
        }
        res.status(200).json({ message: 'Log entry deleted successfully' });
    } catch (error) {
        console.error('Error deleting log entry:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/reset - Reset all data
router.post('/reset', verifyStockPassword, async (req, res) => {
    try {
        const { error: baError } = await supabase.from('blade_assignments').delete().neq('machine_id', ''); // CORRECTED
        const { error: mbError } = await supabase.from('machine_blades').delete().neq('machine_id', ''); // CORRECTED
        const { error: msError } = await supabase.from('machine_status').delete().neq('machine_id', ''); // CORRECTED
        const { error: logError } = await supabase.from('logs').delete().neq('id', -1);

        if (baError || mbError || msError || logError) {
            throw new Error('Failed to reset one or more tables.');
        }

        const { error: invError } = await supabase
            .from('inventory')
            .update({ fixed: 0, available: 0 })
            .neq('group_name', null);

        if (invError) throw invError;

        res.json({ message: 'All data has been reset successfully' });
    } catch (error) {
        console.error('Error resetting data:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;