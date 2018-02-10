var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
const raspi = require('raspi');
const gpio = require('raspi-gpio');
const Serial = require('raspi-serial').Serial;
var proc;



/****************************
 *Gracefull shutdown - begin*
 ****************************/
process.stdin.resume();//so the program will not close instantly

function exitHandler(options, err) {
//    turnServoesOff();
    if (options.cleanup) console.log('clean');
    if (err) console.log(err.stack);
    if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

/****************************
 *Gracefull shutdown - end  *
 ****************************/


/****************************
 * raspi config - Start     *
 ****************************/

raspi.init(() => {
	const input = new gpio.DigitalInput({
		pin: 'P1-3',
		pullResistor: gpio.PULL_UP
		});
	
	const output = new gpio.DigitalOutput('P1-5');
	output.write(input.read());



	var serial = new Serial();
	serial.open(() => {
		serial.write('Hello from raspi-serial');
		serial.on('data', (data) => {
			process.stdout.write(data);
			});
		});
	});
startHeartbeat();


/****************************
 * raspi-config - End       *
 ****************************/


app.use('/', express.static(path.join(__dirname, 'stream')));
app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
    });

var sockets = {};
io.on('connection', function(socket) {
	sockets[socket.id] = socket;
	startStreaming(io);
	console.log("Total clients connected : ", Object.keys(sockets).length);
	socket.on('disconnect', function() {
		delete sockets[socket.id];
		//console.log("Total clients connected: ", Objects.keys(sockets).length);
		// no more sockets, kill the stream
		if (Object.keys(sockets).length == 0) {
			console.log("Killing the stream");
			app.set('motionStarted', false);
			if (proc) 
				proc.kill();
		}
	});
	
	socket.on('start-stream', function(){
	//	startStreaming(io);
	});
	socket.on('move', function(left, right){
		console.log("Moving: " + left + " - " + right);
	});
});



http.listen(3000, function() {
	console.log('listening on *:3000');
});

function stopStreaming() {
	console.log("Stopping camera...");
	if (Object.keys(sockets).length == 0) {
		app.set('watchingFile', false);
		if (proc) 
			proc.kill();
	}
}

function startStreaming(io) {
	if (!app.get('motionStarted')) {
		app.set('motionStarted',true);
		var args = ["-c", "~/.motion/motion.conf"];
		proc = spawn('motion', args);
		console.log('Starting camera...');
		setTimeout(function(){
			console.log("has waited 2 seconds");
			io.sockets.emit('liveStream','http://raspberrypi.local:8081');
		},2000);
		console.log("Wait 2 seconds");
	} else {
	 io.sockets.emit('liveStream', 'http://raspberrypi.local:8081');
	}
}

var heartbeatInterval;
function startHeartbeat(){
	heartbeatInterval = setInterval(function(){
		console.log("Implement heartbeat");
	}, 200);

}
