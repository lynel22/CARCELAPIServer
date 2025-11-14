/**
 * 
 */

var express = require('express'),
	cors = require('cors'),
	bodyParser = require('body-parser');
	

var resources = require('../resources/model');
var jailSensorRoutes = require('../routes/jailSensors');

var app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/', function(req, res) {
	res.send('Hello!')
});


app.use('/jail', jailSensorRoutes);




module.exports = app;