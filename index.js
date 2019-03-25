const crypto = require('crypto');
const Swarm = require('discovery-swarm');
const defaults = require('dat-swarm-defaults');
const getPort = require('get-port');
const readline = require('readline')

// { peer_id: TCP_Connection }
const peers = {};

// COunter for connections, used for identify connections
let connSeq = 0;

// Peer Identity, a random hash for identify your peer
const myId = crypto.randomBytes(32);
console.log('Your identity: ' + myId.toString('hex'));

// reference to redline interface
let rl;

/**
 * Function for safely call console.log with readline interface active
 */
function log() {
    if (rl) {
        rl.clearLine();
        rl.close();
        rl = undefined;
    }
    for (let i = 0, len = arguments.length; i < len; i++) {
        console.log(arguments[i]);
    }
    askUser();
}


// Function to get text input from user and send it to other peers
const askUser = async () => {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Send Message: ', message => {
        // Broadcast to peers
        for (let id in peers) {
            peers[id].conn.write(message);
        }

        rl.close();
        rl = undefined;
        askUser();
    })
}

const config = defaults({
    id: myId
});

const sw = Swarm(config);

; (async () => {
    const port = await getPort();

    sw.listen(port);
    console.log('Listening to port: ' + port);

    sw.join('our-fun-channel');

    sw.on('connection', (conn, info) => {
        const seq = connSeq;
        const peerId = info.id.toString('hex');
        log(`Connected #${seq} to peer: ${peerId}`);

        if (info.initiator) {
            try {
                conn.setKeepAlive(true, 600);
            } catch (exception) {
                log('exception', exception);
            }
        }

        conn.on('data', data => {
            // Here we handle incomming messages
            log('received Message from peer ' + peerId, '----> ' + data.toString());
        });

        conn.on('close', () => {
            // Here we handle peer disconnection
            log(`Connection ${seq} closed, peerid: ${peerId}`);
            if (peers[peerId].seq === seq) {
                delete peers[peerId];
            }
        });

        if(!peers[peerId]){
            peers[peerId]={};
        }
        peers[peerId].conn = conn;
        peers[peerId].seq = seq;
        connSeq++;
    });
    askUser();
})();