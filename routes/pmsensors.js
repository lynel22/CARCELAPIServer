/**
 * 
 */

var express = require('express'),
	router = express.Router();

let pmsensors = [
	{
		"name": "PM10_ESI",
		"description": "Particle Matter 10",
		"unit": "ppm",
		"value": 0
	},
	{
		"name": "PM25_ESI",
		"description": "Particle Matter 2.5",
		"unit": "ppm",
		"value": 0
	}
];


router.route('/').get(function(req, res, next) {
	res.send(pmsensors);
	next();
});

router.route('/newPM').post(function(req, res, next) {
	pmsensors.push(req.body);
	res.status(201).send("Sensor added");
	next();
});


router.route('/:name').get(function(req, res, next) {
	req.result = pmsensors.filter(function(s){
		return s.name == req.params.name;
	})
	next();
});

module.exports = router;