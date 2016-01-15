var Container = machinetalk.protobuf.message.Container;
var ContainerType = machinetalk.protobuf.message.ContainerType;

function get_uuid () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = crypto.getRandomValues(new Uint8Array(1))[0]%16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}
var uuidDealer = get_uuid();
var uuidSub = get_uuid();
var socket = io();

$('form').submit(function(){
    var msg = {type: ContainerType.MT_PING, name: $('#m').val()};
    var encoded = Container.encode(msg).toArrayBuffer();
    socket.emit(uuidDealer + 'msg', encoded);
    $('#m').val('');
    return false;
});

socket.on('connect', function() {
    socket.emit('connect socket', {uri: 'tcp://127.0.0.1:12345', type: 'dealer', uuid: uuidDealer});
    socket.emit('connect socket', {uri: 'tcp://127.0.0.1:12346', type: 'sub', uuid: uuidSub});
});

socket.on(uuidDealer + 'msg', function(msg) {
    var bier = Container.decode(msg[0]);
    $('#messages').append($('<li>').text("me: " + bier.name));
});

socket.on(uuidSub + 'msg', function(msg) {
    var bier = Container.decode(msg[1]);
    $('#messages').append($('<li>').text("other: " + bier.name));
});

socket.on(uuidSub + 'connected', function() {
    socket.emit(uuidSub + 'subscribe', 'msg');
});

$(window).on('beforeunload', function() {
    socket.close();
});
