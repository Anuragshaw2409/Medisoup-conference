import http from 'http';
import express from 'express'
import { Server, Socket } from 'socket.io';
import { generateRoomId } from './Utility';
import { config } from './config';
import { types, createWorker } from 'mediasoup';
import { Room } from './Room';

//crate socket.io server
const app = express();
const httpServer = http.createServer(app);
httpServer.listen(8000,()=>{
    console.log('Server is running on port 8000');
});
const io = new Server(httpServer,{
    cors: {
        origin: "*",
        allowedHeaders:['GET', 'POST']
    }
});
//create a custom interface to store room id in the socket object
interface CustomSocket extends Socket{
    roomId?:string;
}
//required variables for the server
const workers: types.Worker[] = [];
let roomList = new Map();

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
            console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
            workers.filter(work => work.pid!=worker.pid);
            setTimeout(() => process.exit(1), 2000)
        });

        workers.push(worker);
    }
}

(async () => {
    console.log("create workers called");
    await createWorkers();
})()


io.on('connection',(socket: CustomSocket)=>{
    socket.emit('connection-success');


    //when room is already created
    socket.on('connect-room',({roomId, name},callback)=>{
        //if room does not exists
        if(!roomList.has(roomId))
            return callback({success:false, message:"Room does not exists"});
        //if room exists
        const isAdmin = false;
        const response = roomList.get(roomId).addPeer(socket.id, name, isAdmin);
        if(response.success)
            socket.roomId=roomId;
        console.log(response);
        callback(response);
        

    });


    //when room needs to be created
    socket.on('create-room',({name}, callback)=>{
        //create a new room
        const roomId = generateRoomId();
        roomList.set(roomId, new Room(getWorker(), roomId, io));
        //add the socket to the room's peer list
        socket.roomId = roomId;
        const isAdmin = true;
        const response = roomList.get(roomId).addPeer(socket.id, name, isAdmin);
        console.log(response);
        callback(response);

    });





    //get the routers RTP capacbilities
    socket.on('getRouterRPCapabilities', (callback)=>{
        if(!socket.roomId || !roomList.has(socket.roomId)){
           return callback({success:false, message:"You are not in a room"});
        }
        const rtpCapabilities = roomList.get(socket.roomId).getRtpCapbailities();
        callback({success:true, rtpCapabilities});
    });





    //get all the producers present in the room
    socket.on('get-producers', (callback)=>{
        if(!socket.roomId || !roomList.has(socket.roomId)){
            return callback({success:false, message:"You are not in a room"});
        }
        const producers = roomList.get(socket.roomId).getProducers(socket.id);
        
        
        if(!producers)
            return callback({success:false, message:"Cannot get producers"});
       
        console.log({socket:socket.id, room:socket.roomId,producers});
        callback({success:true, producers});
        
    });


    //create webRTC tansport
    socket.on('createWebRTCTransport', async(callback)=>{
        if(!socket.roomId || !roomList.has(socket.roomId)){
            return callback({success:false, message:"You are not in a room"});
        }
        
        const response =await roomList.get(socket.roomId).createTransport(socket.id);
        console.log(response);
        callback(response);
    });






    //connect existing tranport
    socket.on('connect-peer-transport', async({transportId, dtlsParameters}, callback)=>{
        if(!socket.roomId || !roomList.has(socket.roomId)){
            return callback({success:false, message:"You are not in a room"});
        }
        
        const response = await roomList.get(socket.roomId).connectPeerTransport(socket.id, transportId, dtlsParameters);
        console.log(response);
        
        callback(response);
    })


    //create a producer on the exisiting transport with given transport id
    socket.on('produce', async ({transportId, rtpParameters, kind },callback)=>{
        if(!socket.roomId || !roomList.has(socket.roomId)){
            return callback({success:false, message:"You are not in a room"});
        }
        
        const response =await roomList.get(socket.roomId).produce(transportId, rtpParameters,kind, socket.id);

        console.log(response);
        callback(response);
        
    });
    


    socket.on('consume', async ({rtpCapabilities, producerId, transportId},callback)=>{
        if(!socket.roomId || !roomList.has(socket.roomId)){
            return callback({success:false, message:"You are not in a room"});
        }

        const response = await roomList.get(socket.roomId).consume(transportId, rtpCapabilities, producerId, socket.id);
        console.log(response);
        callback(response);
        


    });






})




















let currentWorkerIndex = 0;
function getWorker() {
    if (currentWorkerIndex == config.mediasoup.numWorkers)
        currentWorkerIndex = 0;
    return workers[currentWorkerIndex++];
}