const express = require('express');
const router = express.Router();
const { resources, getRoomFromCoordinates, updateOccupancy } = require('./../resources/model');

router.get('/rooms', (req, res, next) => {
    try {
        const rooms = resources.rooms;
        res.send(rooms);
        next();
    } catch (err) {
        console.error('Error en GET /rooms:', err);
        next(err);
    }
});

router.post('/position', (req, res, next) => {
  try {
    const { prisonerId, x, y } = req.body;

    if (prisonerId === undefined || x === undefined || y === undefined) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const room = getRoomFromCoordinates(x, y);

    // Actualizar posición
    resources.positions[prisonerId] = {
      x,
      y,
      room: room ? room.id : null
    };

    // Recalcular ocupaciones
    const occupancy = updateOccupancy();

    // ======================
    //  DETECCIÓN DE ALERTAS
    // ======================

    // Horario nocturno (00:00 - 06:00) fuera de celdas
    const now = new Date(); //hay que cambiar para que no pille la hora del servidor
    const hour = now.getHours();

    if (hour >= 0 && hour < 6) {
      if (room && room.id !== 'B') {
        console.log(
          `Alerta nocturna: Prisionero ${prisonerId} en ${room.name} (${room.id}) fuera de la sala de celdas`
        );
        // TODO: emitir evento WebSocket 
      }
    }

    // Aforo máximo en comedor o duchas
    if (room && room.maxCapacity) {
      const count = occupancy[room.id];
      if (count > room.maxCapacity) {
        console.log(
          `Aforo excedido en ${room.name}: ${count}/${room.maxCapacity}`
        );
        // TODO: emitir evento WebSocket 
      }
    }

    // ======================

    console.log(
      `📍 Prisionero ${prisonerId}: (${x}, ${y}) → ${room ? room.name : 'Fuera del recinto'}`
    );

    res.json({
      message: 'Posición actualizada',
      room: room ? room.name : 'Fuera del recinto',
      occupancy,
    });

    next(err);

  } catch (err) {
    console.error('Error en POST /position:', err);
    next(err);
  }
});


router.post('/noise', (req, res, next) => {
  try {
    const { sala, noiseLevel } = req.body;

    if (!sala || typeof noiseLevel !== 'number') {
      return res.status(400).json({ error: 'Datos inválidos: se requiere sala y noiseLevel numérico' });
    }

    // Buscar la sala por ID
    const room = resources.rooms.find(r => r.id === sala);
    if (!room) {
      return res.status(404).json({ error: `No se encontró la sala con id ${sala}` });
    }

    // Actualizar el nivel de ruido
    room.noise = noiseLevel;

    // TODO: emitir por WebSocket al dashboard
    // ej: io.emit('noiseUpdate', { sala, noiseLevel });

    // TODO: si supera el umbral, emitir alerta
    // ej: if (noiseLevel > 80) io.emit('noiseAlert', { sala, level: noiseLevel });

    res.status(200).json({
      message: `Nivel de ruido actualizado para sala ${sala}`,
      data: { sala, noiseLevel },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /smoke
 * Recibe y guarda el nivel de humo por sala
 */
router.post('/smoke', (req, res, next) => {
  try {
    const { sala, smokeLevel } = req.body;

    if (!sala || typeof smokeLevel !== 'number') {
      return res.status(400).json({ error: 'Datos inválidos: se requiere sala y smokeLevel numérico' });
    }

    // Buscar la sala por ID
    const room = resources.rooms.find(r => r.id === sala);
    if (!room) {
      return res.status(404).json({ error: `No se encontró la sala con id ${sala}` });
    }

    // Actualizar el nivel de humo
    room.smoke = smokeLevel;

    // TODO: emitir por WebSocket al dashboard
    // ej: io.emit('smokeUpdate', { sala, smokeLevel });

    // TODO: si supera el umbral, emitir alerta
    // ej: if (smokeLevel > 50) io.emit('smokeAlert', { sala, level: smokeLevel });

    res.status(200).json({
      message: `Nivel de humo actualizado para sala ${sala}`,
      data: { sala, smokeLevel },
    });
  } catch (error) {
    next(error);
  }
});
    

module.exports = router;
