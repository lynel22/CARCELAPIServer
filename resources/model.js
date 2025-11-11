/**
 * Modelo en memoria para el sistema de gestión de la cárcel inteligente.
 * Contiene la lista de prisioneros, sus posiciones, salas y ocupaciones.
 */

const resources = {
  prisoners: [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
    { id: 3, name: 'Carlos Pérez' },
  ],

  // Últimas posiciones registradas por prisionero
  positions: {}, // { [prisonerId]: { x, y, room, timestamp } }

  // Ocupación actual por sala
  occupancy: {}, // { [roomId]: cantidad }

  // Definición de salas (polígonos con sus vértices)
  rooms: [
    {
      id: 'A',
      name: 'Comedor',
      polygon: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      noise: 0,
      smoke: 0,
      maxCapacity: 20, // aforo máximo
    },
    {
      id: 'B',
      name: 'Celdas',
      polygon: [
        [6, 10],
        [18, 10],
        [18, 20],
        [6, 20],
      ],
      noise: 0,
      smoke: 0,
    },
    {
      id: 'C',
      name: 'Patio',
      polygon: [
        [12, 0],
        [22, 0],
        [22, 10],
        [12, 10],
      ],
      noise: 0,
      smoke: 0,
    },
    {
      id: 'D',
      name: 'Duchas',
      polygon: [
        [3, 12],
        [6, 12],
        [6, 20],
        [3, 20],
      ],
      noise: 0,
      smoke: 0,
      maxCapacity: 20, // aforo máximo
    },
  ],
};

/**
 * Comprueba si un punto (x, y) está dentro de un polígono.
 * Algoritmo: ray casting (sin dependencias externas)
 */
function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Devuelve la sala en la que se encuentra un punto (x, y),
 * o null si está fuera de todas las salas.
 */
function getRoomFromCoordinates(x, y) {
  for (const room of resources.rooms) {
    if (pointInPolygon(x, y, room.polygon)) {
      return room;
    }
  }
  return null;
}

/**
 * Recalcula la ocupación de todas las salas
 * en base a las posiciones actuales.
 */
function updateOccupancy() {
  const occupancy = {};

  // Inicializa a cero
  for (const room of resources.rooms) {
    occupancy[room.id] = 0;
  }

  // Recorre posiciones actuales
  for (const prisonerId in resources.positions) {
    const pos = resources.positions[prisonerId];
    if (pos && pos.room && occupancy[pos.room] !== undefined) {
      occupancy[pos.room]++;
    }
  }

  resources.occupancy = occupancy;
  return occupancy;
}

module.exports = {
  resources,
  getRoomFromCoordinates,
  updateOccupancy,
};
