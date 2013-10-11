
// get spotify reference
var spotify = require('spotify-node-applescript');

// Port where we'll run the websocket server
var WEB_SOCKETS_PORT = 8888;

// websocket and http servers
var WebSocketServer = require('websocket').server;
var http = require('http');

/**
 * HTTP server
 */
var server = http.createServer(function (request, response) {});
server.listen(WEB_SOCKETS_PORT, function () {
    console.log('Server is listening on port [' + WEB_SOCKETS_PORT + ']');
});

/**
 * WebSocket server
 * WebSocket server is tied to a HTTP server. WebSocket request is just
 * an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6
 */
var socketServer = new WebSocketServer({httpServer: server});

/**
 * Array of active connections
 * @type {Array}
 */
var connections = [];

/**
 * Logging message
 * @param connection
 * @param message
 */
var log = function(connection,message) {
    console.log('[' + connection.remoteAddress + ']: ' + message);
};

// muted bool
var muted = false;

/**
 * Listen to incoming requests
 */
socketServer.on('request',function(request){

    // accept connection
    var connection = request.accept(null, request.origin);

    // log connection
    log(connection,'Welcome');

    // add toconnections list
    connections.push(connection);

    // listen to incomming messages on connection
    connection.on('message',function(message){

        var received = JSON.parse(message.utf8Data);

        log(connection,'Execute ' + received.type);

        switch(received.type) {
            case 'playpause':
                spotify.playPause();
                break;
            case 'next':
                spotify.next();
                break;
            case 'prev':
                spotify.previous();
                break;
            case 'jump':

                log(connection,'Jump to ' + received.data.position);
                spotify.jumpTo(received.data.position);
                break;
            case 'volume':
                if (received.data.direction) {

                    log(connection,'Level ' + received.data.direction);

                    if (received.data.direction === 'up') {
                        spotify.volumeUp();
                    }
                    else if (received.data.direction === 'down') {
                        spotify.volumeDown();
                    }
                }
                else if (received.data.level) {

                    log(connection,'Level ' + received.data.level);

                    spotify.setVolume(Math.min(100,Math.max(0,received.data.level)));
                }
                break;
            case 'mute':
                if (muted) {
                    spotify.unmute();
                    muted = false;
                }
                else {
                    spotify.mute();
                    muted = true;
                }
                break;
            default:
                break;
        }
    });

    connection.on('close', function(connection) {

        // remove from connections list
        for (var i=connections.length-1;i>=0;i--) {
            if (connections[i] === connection) {
                connections.splice(i,1);
                log(connection,'Bye Bye!');
            }
        }
    });

});


/**
 * Poll state from Spotify
 */
var poll = function() {

    spotify.isRunning(function(err,isRunning){

        if (!isRunning) {
            return false;
        }

        spotify.getState(function(err,state){
            spotify.getTrack(function(err, track){
                update('state',{'state':state,'track':track});
                setTimeout(poll,1000);
            });
        });

    });
};

poll();

/**
 * Push information to clients
 */
update = function(type,data) {
    var i,connection;
    for (i=connections.length-1;i>=0;i--) {
        connection = connections[i];
        connection.send(JSON.stringify({
            'type':type,
            'data':data
        }));
    }
};