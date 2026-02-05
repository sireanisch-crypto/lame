const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');

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
            { data: machineStatus, error: msError },
            { data: machineComponents, error: mcError },
            { data: componentInventory, error: ciError }
        ] = await Promise.all([
            supabase.from('inventory').select('*'),
            supabase.from('logs').select('*').order('created_at', { ascending: false }),
            supabase.from('machine_blades').select('*'),
            supabase.from('blade_assignments').select('*'),
            supabase.from('machine_status').select('*'),
            supabase.from('machine_components').select('*'),
            supabase.from('component_inventory').select('*')
        ]);

        // Check for errors in all queries
        if (invError || logError || mbError || baError || msError || mcError || ciError) {
            console.error('Supabase fetch error:', { invError, logError, mbError, baError, msError, mcError, ciError });
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

        // Transform machine components into a nested object
        const machineComponentsObj = machineComponents.reduce((acc, item) => {
            if (!acc[item.machine_id]) {
                acc[item.machine_id] = {};
            }
            if (!acc[item.machine_id][item.component_type]) {
                acc[item.machine_id][item.component_type] = [];
            }
            acc[item.machine_id][item.component_type].push({
                id: item.id,
                spec: item.component_spec,
                quantity: item.quantity
            });
            return acc;
        }, {});

        // Transform component inventory into a structured object
        const componentInventoryObj = componentInventory.reduce((acc, item) => {
            if (!acc[item.component_type]) {
                acc[item.component_type] = [];
            }
            acc[item.component_type].push({ spec: item.spec, stock: item.stock });
            return acc;
        }, {});

        res.json({
            inventory: nestedInventory,
            logs: logs,
            machineBlades: machineBladesObj,
            bladeAssignments: bladeAssignmentsObj,
            machineStatus: machineStatusObj,
            machineComponents: machineComponentsObj,
            componentInventory: componentInventoryObj
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
        // Destructure the body and explicitly discard the 'id'
        const { id, ...logData } = req.body;

        const { machine_name, blade_type, action, amount, person_name, group_name } = logData;

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
        const { error: baError } = await supabase.from('blade_assignments').delete().neq('machine_id', '');
        const { error: mbError } = await supabase.from('machine_blades').delete().neq('machine_id', '');
        const { error: msError } = await supabase.from('machine_status').delete().neq('machine_id', '');
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

// POST /api/machine-components - Update a machine component
router.post('/machine-components', verifyStockPassword, async (req, res) => {
    try {
        const { machine_id, component_type, component_spec, quantity } = req.body;

        // Check if there's enough stock in component_inventory
        const { data: stockData, error: stockError } = await supabase
            .from('component_inventory')
            .select('stock')
            .eq('component_type', component_type)
            .eq('spec', component_spec)
            .single();

        if (stockError || !stockData) {
            return res.status(404).json({ message: 'Component not found in inventory' });
        }

        if (stockData.stock < quantity) {
            return res.status(400).json({ message: 'Insufficient stock in inventory' });
        }

        // Generate a unique ID for the component
        const component_id = `${machine_id}-${component_type}-${Date.now()}`;

        // Add the component to the machine with the generated ID
        const { error } = await supabase
            .from('machine_components')
            .insert({
                id: component_id,
                machine_id,
                component_type,
                component_spec,
                quantity
            });

        if (error) throw error;

        // Update the inventory stock
        const { error: updateError } = await supabase
            .from('component_inventory')
            .update({ stock: stockData.stock - quantity })
            .eq('component_type', component_type)
            .eq('spec', component_spec);

        if (updateError) throw updateError;

        res.status(200).json({ message: 'Machine component added successfully', id: component_id });
    } catch (error) {
        console.error('Error updating machine component:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/machine-components/:id - Delete a component from a machine
router.delete('/machine-components/:id', verifyStockPassword, async (req, res) => {
    try {
        const { id } = req.params;

        // First, get the component details before deleting
        const { data: componentData, error: fetchError } = await supabase
            .from('machine_components')
            .select('component_type, component_spec, quantity')
            .eq('id', id)
            .single();

        if (fetchError || !componentData) {
            return res.status(404).json({ message: 'Component not found' });
        }

        // Delete the component from the machine
        const { error } = await supabase
            .from('machine_components')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Update the inventory stock (add back the quantity)
        const { data: stockData, error: stockError } = await supabase
            .from('component_inventory')
            .select('stock')
            .eq('component_type', componentData.component_type)
            .eq('spec', componentData.component_spec)
            .single();

        if (stockError || !stockData) {
            return res.status(404).json({ message: 'Component not found in inventory' });
        }

        const { error: updateError } = await supabase
            .from('component_inventory')
            .update({ stock: stockData.stock + componentData.quantity })
            .eq('component_type', componentData.component_type)
            .eq('spec', componentData.component_spec);

        if (updateError) throw updateError;

        res.status(200).json({ message: 'Machine component deleted successfully' });
    } catch (error) {
        console.error('Error deleting machine component:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;