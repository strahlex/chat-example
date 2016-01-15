var zmq = require('zmq');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var protobufMessage = require('machinetalk-protobuf').message;
var Container = protobufMessage.Container;
var ContainerType = protobufMessage.ContainerType;

function Responder(routerUri, pubUri) {
    this.routerUri = routerUri;
    this.pubUri = pubUri;
    this.socket = zmq.socket('router');
    this.socket.bindSync(this.routerUri);
    this.pubSocket = zmq.socket('pub');
    this.pubSocket.bindSync(this.pubUri);

    this.socket.on('message', this.respond.bind(this));
}
util.inherits(Responder, EventEmitter);

Responder.prototype.respond = function() {
    var args = Array.apply(null, arguments);
    console.log('incoming', args[args.length-1].toString());
    this.pubSocket.send(['msg', args[args.length-1]]);
    this.socket.send(args);
};

function Publisher(uri) {
    this.uri = uri;
    this.socket = zmq.socket('pub');
    this.socket.bindSync(this.uri);

    setInterval(this.publish.bind(this), 500);
}
util.inherits(Publisher, EventEmitter);

Publisher.prototype.publish = function() {
    var msg = {type: ContainerType.MT_PING, name: "123456789"};
    var encoded = Container.encode(msg).toBuffer();
    this.socket.send(['topic1', encoded]);
    this.socket.send(['topic2', 'test2']);
};

function Sender(uri) {
    this.uri = uri;
    this.socket = zmq.socket('dealer');
    this.socket.connect(this.uri);

    this.socket.on('message', function(msg) {
        console.log('received', msg.toString());
    });

    setInterval(this.sendMessage.bind(this), 500);
}
util.inherits(Sender, EventEmitter);

Sender.prototype.sendMessage = function() {
    this.socket.send('test');
};

var responder = new Responder('tcp://127.0.0.1:12345', 'tcp://127.0.0.1:12346');
//var sender = new Sender('tcp://127.0.0.1:12345');
var publisher = new Publisher('tcp://127.0.0.1:12347');
