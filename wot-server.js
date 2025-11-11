/**
 * 
 */

var httpServer = require('./servers/http-server');

var resources = require('./resources/model');

var webSocketServer= require('./servers/websocket');

var wotServer = httpServer.listen(8484, function() {
	console.log('HTTP server started and running at port 8484');
	webSocketServer.listen(wotServer);
});

//simulator.start();