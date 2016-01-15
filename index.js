var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var _ = require('underscore');
var SocketManager = require('./socketmanager.js');

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});
app.get('/client.js', function(req, res){
  res.sendFile(__dirname + '/client.js');
});
app.get('/machinetalk-protobuf.min.js', function(req, res){
  res.sendFile(__dirname + '/machinetalk-protobuf.min.js');
});


var socketManager = new SocketManager(io);
// var retVal = socketManager.connectSocket({type: 'dealer', uri: 'tcp://127.0.0.1:12345'});
// var subscriber = socketManager.connectSocket({type: 'sub', uri: 'tcp://127.0.0.1:12346'});
// var subscriber2 = socketManager.connectSocket({type: 'sub', uri: 'tcp://127.0.0.1:12346'});
// var sendMessage = function() {
//     retVal.socket.send('bla');
// }
// setInterval(sendMessage, 500);
// subscriber.socket.subscribe('topic1');
// subscriber2.socket.subscribe('topic1');
// subscriber.socket.on('message', function (topic, msg) {
//     console.log('got', msg.toString());
// });

// retVal.socket.on('message', function (msg) {
//     console.log('got reply', msg.toString());
// });

http.listen(3000, function(){
  console.log('listening on *:3000');
});
