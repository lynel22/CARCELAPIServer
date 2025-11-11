/**
 * 
 */
var WebSocketServer = require('ws').Server;

exports.listen = function(server) {
	var wss = new WebSocketServer({server:server});
	console.info('WebSocket server started...');
	console.log(wss.address());
	
	wss.on('connection', function (ws,req) {
  			console.log("Received WS connection from: " + req.socket.remoteAddress);
			
			ws.on('message', function incoming(message) {
						console.log('received:%s', message);
			});
			console.log('sending');
			ws.send('something');
			console.log('sent');
	});
};