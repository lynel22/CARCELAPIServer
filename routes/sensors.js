/**
 * 
 */

var express = require('express'),
	router = express.Router(),
	resources = require('./../resources/model');
	
var mqttws= require('../MQTTWebSockets');
router.route('/').get(function(req, res, next) {
	res.send(resources.airQuality.sensors);
	next();
});
router.route('/CO').get(function(req, res, next) {
	req.result = resources.airQuality.sensors.CO;
	next();
});

router.route('/newCOvalue').put(function(req, res, next) {
	resources.airQuality.sensors.CO.value = req.body.value;
	res.status(201).send("Value updated");
	next();
});

router.route('/newPM10').post(function(req, res, next) {
	resources.airQuality.sensors.PM10 = req.body;
	res.status(201).send("Value updated");
	mqttws.publish("/sensors/PM10", JSON.stringify(resources.airQuality.sensors.PM10));
	next();
});


module.exports = router;