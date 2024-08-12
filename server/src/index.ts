import http from 'http'
import express from 'express'
import mediasoup, { types, createWorker } from 'mediasoup'
import { Socket, Server } from 'socket.io'
const PORT = 8000;
import { config } from './config'
import { Room } from './Room';

const app = express();
app.get('/', (req, res) => {
    res.send("Hello world");
})
const httpServer = http.createServer(app);
httpServer.listen(PORT, async () => {
    console.log("Listening on port: ", PORT);

});


//call create workers to create workers at the time of starting
async function createWorkers() {

    if (!config)
        return;
    for (let i = 0; i < config.mediasoup.numWorkers; i++) {
        let worker: types.Worker = await createWorker({
            logLevel: config?.mediasoup?.worker?.logLevel,
            logTags: config?.mediasoup?.worker?.logTags,
            rtcMinPort: config?.mediasoup?.worker?.rtcMinPort,
            rtcMaxPort: config?.mediasoup?.worker?.rtcMaxPort,

        });
        worker.on('died', () => {
            console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid)
            setTimeout(() => process.exit(1), 2000)
        });

        workers.push(worker);
    }
}

(async () => {
    console.log("create workers called");
    await createWorkers();
})()
// ------------------------------------------------------------




const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});



interface CustomSocket extends Socket {
    roomId?: string
}



const workers: types.Worker[] = [];
const roomList = new Map();

io.on('connection', (socket: CustomSocket) => {
    console.log("connected to socket: ", socket.id);
    socket.emit('connection-success', { socketId: socket.id });

    socket.on('connect-room', ({ roomId, name }, callback) => {
        if (roomList.has(roomId)) {
            //create a peer instanct and add to the room and socket.roomId = roomId
            
            roomList.get(roomId).addPeer(socket.id, name);
            console.log("connect room called", roomId);
            socket.roomId = roomId
            return callback({ success: true, roomId })
        }
        else {
            console.log("Room does not exists", roomId);
            return callback({ success: false });
        }

    });

    socket.on('create-room', ({name},response) => {
        console.log("Create room called");

        const generatedRoomId = generateRoomId();
        roomList.set(generatedRoomId, new Room(getWorker(), io, generatedRoomId));
        // add the socket to the room id
        roomList.get(generatedRoomId).addPeer(socket.id, name);
        socket.roomId = generatedRoomId;
        console.log(roomList.keys());
        return response({ success: true, roomId: generatedRoomId });
    });

    // ----------------------------------------------get rtp capabilities---------------------------

    socket.on('getRouterRPCapabilities', (callback)=>{
        if(!socket.roomId)
            return callback({success:false, message:"SOcket not connected to any room"});
 
         const roomId = socket.roomId;
         const rtpcapabilities = roomList.get(roomId).getRTPCapabilities();
         return callback({success:true, params:rtpcapabilities});

    });

    // ------------------------------------------------create transport ---------------------------------
    socket.on('createWebRTCTransport', async(callback)=>{
        if(!socket.roomId)
           return callback({success:false, message:"SOcket not connected to any room"});

        const roomId = socket.roomId;
        if(!roomList.has(roomId) || !roomList.get(roomId).hasPeer(socket.id))
           return callback({success:false, message:"Room does not exists or peer not connected to room"});

        const params = await roomList.get(roomId).createTransport(socket.id)
        callback({success:true, params});

    });

    // --------------------------------------------------connect transport-------------------------------------
    socket.on('connect-transport', async({transportId, dtlsParameters},callback)=>{
        if(!socket.roomId || !roomList.get(socket.roomId).hasPeer(socket.id) || !roomList.has(socket.roomId))
            return callback({success:false, message:"Room does not exists or peer not connected to room"});
        
        await roomList.get(socket.roomId).connectPeerTransport(transportId, dtlsParameters, socket.id);
       
    })

    //---------------------------------------------------make a transport produce and call produce methiod-----------------------

    socket.on('produce', async({rtpParameter, kind, transportId}, callback)=>{
        if(!socket.roomId || !roomList.get(socket.roomId).hasPeer(socket.id) || !roomList.has(socket.roomId))
            return callback({success:false, message:"Room does not exists or peer not connected to room"});
        
        
        const producer  =await roomList.get(socket.roomId).produce(rtpParameter, kind, transportId, socket.id);
        callback({
            id: producer.id
        });
    })


    //----------------------------------------------------

    socket.on('consume', async({ producerId, transportId, rtpCapabilities }, callback) => {
              
    
        if (!socket.roomId || !roomList.get(socket.roomId).hasPeer(socket.id) || !roomList.has(socket.roomId)) {
            return callback({ success: false, message: "Room does not exist or peer not connected to room" });
        }
        
        
        const params =await roomList.get(socket.roomId).consume(rtpCapabilities,producerId,transportId, socket.id);
        
        
        if (!params) {
            return callback({ success: false, message: "Cannot consume" });
        }
        
        callback({ success: true, params});
    });


    socket.on('consumer-resume', ({transportId}:{transportId:string}, callback)=>{
        if (!socket.roomId || !roomList.get(socket.roomId).hasPeer(socket.id) || !roomList.has(socket.roomId)) {
            return callback({ success: false, message: "Room does not exist or peer not connected to room" });
        }       

        const {success} = roomList.get(socket.roomId).consumerResume(socket.id, transportId);
        return callback({success})
    })

    socket.on('get-producers', (callback)=>{
        if(!socket.roomId || !roomList.get(socket.roomId).hasPeer(socket.id) || !roomList.has(socket.roomId))
            return callback({success:false, message:"Room does not exists or peer not connected to room"});
        const producersList = roomList.get(socket.roomId).getAllproducers(socket.id);

        callback({success:true, producersList});


    })




});





function generateRoomId() {
    const alphabets = 'abcdefghijklmnopqrstuvwxyz';
    let generatedId = "";
    for (let i = 0; i < 10; i++) {
        if (i == 3 || i == 7)
            generatedId += "-";
        generatedId += alphabets.charAt(generateRandomNumber());
    }
    return generatedId;



    function generateRandomNumber() {
        return Math.floor(Math.random() * 26);
    }
}


let currentWorkerIndex = 0;
function getWorker() {
    if (currentWorkerIndex == config.mediasoup.numWorkers)
        currentWorkerIndex = 0;
    return workers[currentWorkerIndex++];
}




