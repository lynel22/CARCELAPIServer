var mqtt = require("mqtt");
const clientId = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
const host = 'ws://broker.emqx.io:8083/mqtt'; // Use ws://broker.emqx.io:8083/mqtt
const options = {
    keepalive: 60,
    clientId: clientId,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    will: {
        topic: 'WillMsg',
        payload: 'Connection Closed abnormally..!',
        qos: 0,
        retain: false
    },
};
console.log('Connecting mqtt client');
const client = mqtt.connect(host, options);

module.exports = client;