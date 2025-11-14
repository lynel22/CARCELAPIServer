const express = require('express');
const router = express.Router();
const { resources, getRoomFromCoordinates, updateOccupancy } = require('./../resources/model');
var mqttws = require('../MQTTWebSockets');
var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://localhost');

// Sets para controlar alertas únicas
const nightAlertsSent = new Set();
const capacityAlertsSent = new Set();

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
 * DELETE /rest
 * Reinicia el sistema borrando todos los prisioneros y posiciones
 */
router.delete('/reset', (req, res, next) => {
    try {
        resources.prisoners = [];
        resources.positions = {};
        resources.occupancy = {};
        resources.time = { hour: 0, minute: 0 };

        client.publish('carcel/reiniciar', JSON.stringify({}));

        res.json({ message: 'Sistema reiniciado' });
        next();
    } catch (err) {
        console.error('Error en DELETE /reset:', err);
        next(err);
    }
});

/** 
 * POST /time
 * Recibe la hora actual y la publica por mqtt
 */
router.post('/time', (req, res, next) => {
    try {
        const { hour, minute } = req.body;
        if (hour === undefined || minute === undefined) {
            return res.status(400).json({ error: 'Faltan datos' });
        }
        resources.time.hour = hour;
        resources.time.minute = minute;
        mqttws.publish('jail/time', JSON.stringify({ hour, minute }));

        res.json({ message: 'Hora enviada por MQTT'+ hour + ':' + minute });
        next();
    } catch (err) {
        console.error('Error en POST /time:', err);
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

        // --- Dentro de tu lógica de actualización ---
        const hour = resources.time.hour;

        // --- Alerta nocturna ---
        if (hour >= 0 && hour < 6) {
            if (room && room.id !== 'B') {
                // Generar un ID único para el preso y la sala
                const alertId = `${prisonerId}_${room.id}`;
                if (!nightAlertsSent.has(alertId)) {
                    console.log(`Alerta nocturna: ${alertId} Set: ${[...nightAlertsSent]}`);
                    mqttws.publish('jail/alerts/night', JSON.stringify({prisonerId, roomId: room.id}));
                    nightAlertsSent.add(alertId);
                }
            }
        } else {
            // Resetear alerta fuera del horario nocturno
            nightAlertsSent.clear();
        }

        // --- Alerta de aforo máximo ---
        if (room && room.maxCapacity) {
            const count = occupancy[room.id];
            if (count > room.maxCapacity) {
                if (!capacityAlertsSent.has(room.id)) {
                    mqttws.publish('jail/alerts/capacity', JSON.stringify({sala: room.id}));
                    capacityAlertsSent.add(room.id);
                }
            } else {
                // Resetear alerta si ya no hay sobrecupo
                capacityAlertsSent.delete(room.id);
            }
        }

        // console.log(`Prisionero ${prisonerId}: (${x}, ${y}) → ${room ? room.name : 'Fuera del recinto'}`);

        res.json({
            message: 'Posición actualizada',
            room: room ? room.name : 'Fuera del recinto',
            occupancy,
        });

        // publicar por ws todos los prisioneros en un solo mensaje cuando llegue el que tiene el id igual a la longitud del array
        if (prisonerId === resources.prisoners.length) {
            const allPrisoners = [];
            for (let prisoner of resources.prisoners) {
                const pos = resources.positions[prisoner.id];
                const prName = resources.prisoners.find(p => p.id === prisoner.id)?.name || 'Desconocido';
                const prRoom = getRoomFromCoordinates(pos.x, pos.y);
                allPrisoners.push({ prisonerId: prisoner.id, x: pos.x, y: pos.y, name: prName, room: prRoom ? prRoom.name : 'Fuera del recinto' });
            }
            mqttws.publish('jail/prisoners', JSON.stringify(allPrisoners));
            mqttws.publish('jail/occupancy', JSON.stringify(occupancy));
        }

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


        // emitir por WebSocket al dashboard todas las habitaciones cuando le llega la de D todo en un solo mensaje
        if (sala === 'D') {
            const noiseLevels = {};
            resources.rooms.forEach(r => {
                noiseLevels[r.id] = r.noise;
            });
            mqttws.publish('jail/noise', JSON.stringify(noiseLevels));
        }

        // si supera el umbral, emitir alerta
        if (noiseLevel > 90) {
            console.log(`Alerta de ruido: Nivel de ruido alto en sala ${sala}`);
            mqttws.publish('jail/alerts/noise', JSON.stringify({sala}));
        }

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

        // Si supera el umbral, emitir alerta por mqtt a carcel/aspersor
        if (smokeLevel > 1) {
            mqttws.publish('jail/alerts/sprinkler', JSON.stringify({ sala }));
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
