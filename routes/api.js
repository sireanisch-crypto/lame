const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyStockPassword } = require('../middleware/auth');

// Get all data
router.get('/data', async (req, res) => {
  try {
    const inventoryQuery = 'SELECT * FROM inventory';
    const logsQuery = 'SELECT * FROM logs ORDER BY created_at DESC';
    const machineBladesQuery = 'SELECT * FROM machine_blades';
    const bladeAssignmentsQuery = 'SELECT * FROM blade_assignments';
    const machineStatusQuery = 'SELECT * FROM machine_status';  // ADD THIS LINE
    
    const [inventoryResult, logsResult, machineBladesResult, bladeAssignmentsResult, machineStatusResult] = await Promise.all([
      db.query(inventoryQuery),
      db.query(logsQuery),
      db.query(machineBladesQuery),
      db.query(bladeAssignmentsQuery),
      db.query(machineStatusQuery)  // ADD THIS LINE
    ]);
    
    // Transform inventory data to match frontend structure
    const inventory = {};
    inventoryResult.rows.forEach(item => {
      if (!inventory[item.group_name]) {
        inventory[item.group_name] = {};
      }
      inventory[item.group_name][item.blade_type] = {
        fixed: item.fixed,
        available: item.available
      };
    });
    
    // Transform machine blades data
    const machineBlades = {};
    machineBladesResult.rows.forEach(item => {
      machineBlades[item.machine_id] = item.blade_type;
    });
    
    // Transform blade assignments data
    const bladeAssignments = {};
    bladeAssignmentsResult.rows.forEach(item => {
      bladeAssignments[item.machine_id] = {
        type: item.blade_type,
        count: item.count
      };
    });
    
    // Transform machine status data  // ADD THIS SECTION
    const machineStatus = {};
    machineStatusResult.rows.forEach(item => {
      machineStatus[item.machine_id] = item.status;
    });
    
    res.json({
      inventory,
      logs: logsResult.rows,
      machineBlades,
      bladeAssignments,
      machineStatus  // ADD THIS LINE
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
    
    const query = `
      INSERT INTO inventory (group_name, blade_type, fixed, available)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (group_name, blade_type)
      DO UPDATE SET
        fixed = EXCLUDED.fixed,
        available = EXCLUDED.available
      RETURNING *
    `;
    
    const result = await db.query(query, [group_name, blade_type, fixed, available]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add log entry
router.post('/logs', verifyStockPassword, async (req, res) => {
  try {
    const { machine_name, blade_type, action, amount, person_name, group_name } = req.body;
    
    const query = `
      INSERT INTO logs (machine_name, blade_type, action, amount, person_name, group_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await db.query(query, [machine_name, blade_type, action, amount, person_name, group_name]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding log entry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update machine blade
router.post('/machine-blades', verifyStockPassword, async (req, res) => {
  try {
    const { machine_id, blade_type } = req.body;
    
    const query = `
      INSERT INTO machine_blades (machine_id, blade_type)
      VALUES ($1, $2)
      ON CONFLICT (machine_id)
      DO UPDATE SET
        blade_type = EXCLUDED.blade_type
      RETURNING *
    `;
    
    const result = await db.query(query, [machine_id, blade_type]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating machine blade:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update blade assignment
router.post('/blade-assignments', verifyStockPassword, async (req, res) => {
  try {
    const { machine_id, blade_type, count } = req.body;
    
    const query = `
      INSERT INTO blade_assignments (machine_id, blade_type, count)
      VALUES ($1, $2, $3)
      ON CONFLICT (machine_id)
      DO UPDATE SET
        blade_type = EXCLUDED.blade_type,
        count = EXCLUDED.count
      RETURNING *
    `;
    
    const result = await db.query(query, [machine_id, blade_type, count]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating blade assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update machine status  // ADD THIS NEW ENDPOINT
router.post('/machine-status', verifyStockPassword, async (req, res) => {
  try {
    const { machine_id, status } = req.body;
    
    const query = `
      INSERT INTO machine_status (machine_id, status)
      VALUES ($1, $2)
      ON CONFLICT (machine_id)
      DO UPDATE SET
        status = EXCLUDED.status
      RETURNING *
    `;
    
    const result = await db.query(query, [machine_id, status]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating machine status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete log entry - Fixed route parameter handling
router.delete('/logs/:id', verifyStockPassword, async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM logs WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Log entry not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error deleting log entry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset all data
router.post('/reset', verifyStockPassword, async (req, res) => {
  try {
    await db.query('DELETE FROM blade_assignments');
    await db.query('DELETE FROM machine_blades');
    await db.query('DELETE FROM machine_status');  // ADD THIS LINE
    await db.query('DELETE FROM logs');
    
    // Reset inventory to zero
    const inventoryQuery = 'SELECT * FROM inventory';
    const inventoryResult = await db.query(inventoryQuery);
    
    for (const item of inventoryResult.rows) {
      await db.query(
        'UPDATE inventory SET fixed = 0, available = 0 WHERE group_name = $1 AND blade_type = $2',
        [item.group_name, item.blade_type]
      );
    }
    
    res.json({ message: 'All data has been reset successfully' });
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
