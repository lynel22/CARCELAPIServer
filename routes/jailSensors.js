const express = require('express');
const router = express.Router();
const { resources, getRoomFromCoordinates, updateOccupancy } = require('./../resources/model');
var mqttws = require('../MQTTWebSockets');
var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://localhost');

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

/**
 * POST /position
 * Recibe un prisionero y lo envia por mqtt a node-red
 */
router.post('/prisoner', (req, res, next) => {
    try {
        const { room, name } = req.body;
        const id = resources.prisoners.length + 1;

        if (room === undefined || name === undefined) {
            return res.status(400).json({ error: 'Faltan datos' });
        }

        client.publish('carcel/preso', JSON.stringify({ id, room }));

        resources.prisoners.push({ id, name });

        res.json({ message: 'Posición de prisionero enviada por MQTT' });
        next();
    }
    catch (err) {
        console.error('Error en POST /prisoner:', err);
        next(err);
    }
});
    
/**
 * POST /position
 * Recibe la posición (x, y) de un prisionero,
 * actualiza su sala y recalcula ocupaciones.
 * Además, detecta y emite alertas si es necesario.
 * */
router.post('/position', (req, res, next) => {
    try {
        const { prisonerId, x, y } = req.body;
        const name = resources.prisoners.find(p => p.id === prisonerId)?.name || 'Desconocido';

        if (prisonerId === undefined || x === undefined || y === undefined) {
            return res.status(400).json({ error: 'Faltan datos' });
        }

        const room = getRoomFromCoordinates(x, y);

        // Actualizar posición
        resources.positions[prisonerId] = { x, y, room: room ? room.id : null };

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

        // console.log(`Prisionero ${prisonerId}: (${x}, ${y}) → ${room ? room.name : 'Fuera del recinto'}`);

        res.json({
            message: 'Posición actualizada',
            room: room ? room.name : 'Fuera del recinto',
            occupancy,
        });

        mqttws.publish('jail/prisoners', JSON.stringify({ prisonerId, x, y, name, room: room ? room.name : 'Fuera del recinto', occupancy }));

        next();

    } catch (err) {
        console.error('Error en POST /position:', err);
        next(err);
    }
});

/**
 * POST /noise
 * Recibe y guarda el nivel de ruido por sala
 * */
router.post('/noise', (req, res, next) => {
    try {
        const { sala, noiseLevel } = req.body;

        if (!sala || typeof noiseLevel !== 'number') { return res.status(400).json({ error: 'Datos inválidos: se requiere sala y noiseLevel numérico' }); }

        // Buscar la sala por ID y actualiza el nivel de ruido
        const room = resources.rooms.find(r => r.id === sala);
        room.noise = noiseLevel;

        // console.log(`Noise level in room ${sala} updated to ${noiseLevel}`);

        // TODO: emitir por WebSocket al dashboard todas las habitaciones cuando le llega la de D todo en un solo mensaje
        if (sala === 'D') {
            const noiseLevels = {};
            resources.rooms.forEach(r => {
                noiseLevels[r.id] = r.noise;
            });
            mqttws.publish('jail/noise', JSON.stringify(noiseLevels));
        }

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

        if (!sala || typeof smokeLevel !== 'number') { return res.status(400).json({ error: 'Datos inválidos: se requiere sala y smokeLevel numérico' });}

        // Buscar la sala por ID y actualizar el nivel de humos
        const room = resources.rooms.find(r => r.id === sala);
        room.smoke = smokeLevel;

        // Emitir por WebSocket al dashboard las 4 habitaciones cuando le llega la de D todo en un solo mensaje
        if (sala === 'D') {
            const smokeLevels = {};
            resources.rooms.forEach(r => {
                smokeLevels[r.id] = r.smoke;
            });
            mqttws.publish('jail/smoke', JSON.stringify(smokeLevels));
        }
        // console.log(`Smoke level in room ${sala} updated to ${smokeLevel}`);
        // mqttws.publish('jail/smoke', JSON.stringify({ sala, smokeLevel }));

        // Si supera el umbral, emitir alerta por mqtt a carcel/aspersor
        if (smokeLevel > 1) {
            client.publish('carcel/aspersor', JSON.stringify({ sala }));
        }

        res.status(200).json({
            message: `Nivel de humo actualizado para sala ${sala}`,
            data: { sala, smokeLevel },
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
