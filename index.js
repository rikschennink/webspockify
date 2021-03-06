(function(http,websockets,spotify) {

    var WEB_SOCKETS_PORT = 8888;
    var server = http.createServer(function (request, response) {});
    server.listen(WEB_SOCKETS_PORT, function () {
        console.log('Server running at "http://localhost:' + WEB_SOCKETS_PORT + '"');
    });
    var socketServer = new websockets.server({httpServer: server});

    /**
     * Logging message
     * @param connection
     * @param message
     */
    var log = function(connection,message) {
        console.log('[' + connection.remoteAddress + ']: ' + message);
    };

    // active connections
    var connections = [];

    // are we in muted state
    var muted = false;

    /**
     * Listen to incoming requests
     */
    socketServer.on('request',function(request){

        // accept incoming connection
        var connection = request.accept(null, request.origin);

        // log connection
        log(connection,'Welcome!');

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
                        spotify.unmuteVolume();
                        muted = false;
                    }
                    else {
                        spotify.muteVolume();
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


}(require('http'),require('websocket'),require('spotify-node-applescript')));