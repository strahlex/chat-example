var zmq = require('zmq');
var util = require('util');
var uuid = require('uuid');
var EventEmitter = require('events').EventEmitter;
var protobufMessage = require('machinetalk-protobuf').message;
var Container = protobufMessage.Container;
var ContainerType = protobufMessage.ContainerType;

function ZmqConnection(uri, type, uuid) {
    this.uri = uri;
    this.type = type;
    this.socket = zmq.socket(type);
    this.timeout = 2000;

    this.socket.connect(this.uri);
    this.socket.on('message', this.emit.bind(this, 'message'));
    //this.socket.on('message', this.refreshTimeout.bind(this));

    this.timer = undefined;
    //this.refreshTimeout();
    // function (msg) {
    //     this.emit('message', msg);
    //     //console.log('test', msg.toString());
    // });
}
util.inherits(ZmqConnection, EventEmitter);

// refresh a timeout
ZmqConnection.prototype.refreshTimeout = function() {
    clearTimeout(this.timer);
    this.timer = setTimeout(this.close.bind(this), this.timeout);
};

ZmqConnection.prototype.close = function() {
    clearTimeout(this.timer);
    this.socket.close();
    this.emit('closed', this);
    delete this;
};

function ZmqBroker(uri, type) {
    this.uri = uri;
    var transport = (type === 'dealer' ? 'inproc://' : 'ipc://ipc/');
    this.backendUri = transport + uuid.v4();
    this.type = type;
    this.frontend = zmq.socket(type === 'sub' ? 'xsub' : type);
    this.backend = zmq.socket(type === 'dealer' ? 'router' : 'xpub');
    this.connections = new Set();

    this.frontend.connect(this.uri);
    this.backend.bindSync(this.backendUri);
    this.createBroker(this.frontend, this.backend);
}
util.inherits(ZmqBroker, EventEmitter);

ZmqBroker.prototype.createConnection = function () {
    var connection = new ZmqConnection(this.backendUri, this.type);
    connection.on('closed', this.connectionClosed.bind(this));
    this.connections.add(connection);
    return connection;
};

ZmqBroker.prototype.connectionClosed = function(connection) {
    this.connections.delete(connection);
    if (this.connections.size === 0) {
        this.close();
    }
};

ZmqBroker.prototype.createBroker =  function(frontend, backend) {
    frontend.on('message', function() {
        // Note that separate message parts come as function arguments.
        var args = Array.apply(null, arguments);
        // Pass array of strings/buffers to send multipart messages.
        backend.send(args);
    });

    backend.on('message', function() {
        var args = Array.apply(null, arguments);
        frontend.send(args);
    });
};

ZmqBroker.prototype.close = function() {
    this.backend.close();
    this.frontend.close();
    this.emit('closed', this.type, this.uri);
};

function SocketManager(io) {
    this.brokers = {sub: {}, dealer: {}}; // map of brokers
    this.io = io;
    this.connections = {};

    io.on('connection', this._handleConnection.bind(this));
}
util.inherits(SocketManager, EventEmitter);

SocketManager.prototype._handleConnection = function(socket) {
    socket.on('chat message', function(msg) {
        socket.broadcast.emit('chat message', msg);
    });

    socket.on('connect socket', this.connectSocket.bind(this, socket));
    socket.on('disconnect socket', this.disconnectSocket.bind(this));
};

SocketManager.prototype.connectSocket = function(socket, msg) {
    console.log(msg);
    var connection = this.createSocket(msg);
    if (connection !== undefined) {
        var uuid = msg.uuid;
        var type = msg.type;
        this.connections[uuid] = connection;

        socket.on('disconnect', this.websocketDisconnected.bind(this, uuid));
        connection.on('message', this.socketMessageReceived.bind(this, socket, type, uuid));
        if (type === 'sub') {
            socket.on(uuid + 'subscribe', this.websocketSubscribeReceived.bind(this, connection));
            socket.on(uuid + 'unsubscribe', this.websocketUnsubscribeReceived.bind(this, connection));
        }
        else {
            socket.on(uuid + 'msg', this.websocketMessageReceived.bind(this, connection));
        }
        socket.emit(uuid + 'connected');
    }
    else {
        socket.emit('error', 'something went wrong');
    }
};

SocketManager.prototype.disconnectSocket = function(msg) {
    if (msg.uuid !== undefined) {
        this.closeSocket(msg.uuid);
    }
};

SocketManager.prototype.socketMessageReceived = function (socket, type, uuid) {
    var args = Array.apply(null, arguments);
    args.splice(0, 3);  // remove normal params
    if (type === 'sub') {
        args[0] = args[0].toString();
    }
    socket.emit(uuid + 'msg', args);
};

SocketManager.prototype.websocketMessageReceived = function(connection, msg) {
    connection.socket.send(msg);
};

SocketManager.prototype.websocketSubscribeReceived = function(connection, msg) {
    connection.socket.subscribe(msg);
};

SocketManager.prototype.websocketUnsubscribeReceived = function(connection, msg) {
    connection.socket.unsubscribe(msg);
};

SocketManager.prototype.websocketDisconnected = function(uuid) {
    this.closeSocket(uuid);
};

SocketManager.prototype.createSocket = function(msg) {
    if ((msg.uri === undefined)
        || (msg.type === undefined)
        || (msg.uuid == undefined)) {
        return undefined;
    }

    if ((msg.type !== 'sub') && (msg.type !== 'dealer')) {
        return undefined;
    }

    var broker = this.brokers[msg.type][msg.uri];
    if (broker === undefined) {
        broker = new ZmqBroker(msg.uri, msg.type);
        this.brokers[msg.type][msg.uri] = broker;
        broker.on('closed', this.brokerClosed.bind(this));
    }
    return broker.createConnection();  // TODO use connection
};

SocketManager.prototype.closeSocket = function(uuid) {
    var connection = this.connections[uuid];
    if (connection !== undefined) {
        connection.close();
        delete this.connections[uuid];
        console.log('socket closed');
    }
};

SocketManager.prototype.brokerClosed = function(type, uri) {
    delete this.brokers[type][uri];
};

module.exports = SocketManager;
