import React, { useRef, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { types, Device } from "mediasoup-client";
import { params } from "./config";




// Parent component
function Meeting() {
  const { roomid, name } = useParams();
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const [socket, setSocket] = useState<Socket>();
  const [producerTransport, setProducerTransport] = useState<types.Transport>();
  const consumerTransports = new Map();
  const [allProducers, setAllProducers] = useState<string[] | null>(null);
  const [device, setDevice] = useState<types.Device | null>(null);
  const [roomId, setRoomId] = useState<string | undefined>(roomid);
  const [routerRTPCapabilities, setRouterRTPCapabilities] = useState<types.RtpCapabilities>();
  const [isConnected, setIsConnected] = useState(false);
  const [localMediaParams, setMediaParams] = useState(params);
  const [remoteVideoBox, setRemoteVideoBox] = useState<JSX.Element[]>([]);
  const remoteVideoRefs = useRef<React.RefObject<HTMLVideoElement>[]>([]);
  const navigate = useNavigate();



  useEffect(() => {
    // connect to socket
    const socket = io('http://localhost:8000');
    setSocket(socket);

    // if there is room id try to connect to that room if valid
    if (roomId) {
      socket.emit('connect-room', { roomId, name }, (callback: any) => {
        if (callback.success) {
          setIsConnected(true);
        }
        else {
          console.log("Room does not exists");
          alert("Room does not exists");
          navigate(`/`);
        }
      });
    }
    //if no room id then send request to create a room
    else {
      socket.emit('create-room', { name }, (response: any) => {
        if (response.success) {
          console.log('connected to room', response.roomId);
          setRoomId(response.roomId);
          setIsConnected(true);
          navigate(`/meeting/${response.roomId}/${name}`, { replace: true });
        }
        else {
          console.log("Cannot connect to any room");
        }
      });

    }

  }, [])
  // ---------------------------connected to a room-------------------


  useEffect(() => {
    if (isConnected) {
      getRTPCapabilityPromise();
      getAllProducers();

    }
  }, [isConnected])

  // -------------------get RTP Capabilities when connected to a room------------
  function getRTPCapabilityPromise() {

    socket?.emit("getRouterRPCapabilities", (callback: any) => {
      if (callback.success) {
        setRouterRTPCapabilities(callback.params);
      }
      else {
        alert(`cannot get RTP capabilities ${callback.message}`);
        return;
      }
    });

  }

  //---------------------get list of all producers in the room--------------------
  async function getAllProducers() {

    console.log("Get all producers called");

    socket?.emit('get-producers', (callback: any) => {
      if (callback.success) {
        setAllProducers(callback.producersList);
        console.log("All producers: ", callback.producersList);
      }
    })

  }

  useEffect(() => {
    if (routerRTPCapabilities) {
      createDevice(routerRTPCapabilities);
      getUserMedia();
    }
  }, [routerRTPCapabilities])


  //------------------------------create device after getting rtp of router-------------
  async function createDevice(params: any) {

    try {
      const device = new Device();
      setDevice(device);
      await device.load({
        routerRtpCapabilities: params
      });
      console.log("Loaded device: ", device);


    } catch (error) {
      alert(error);

    }
  }

  //--------------------get media device of user---------------------------
  async function getUserMedia() {

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (localRef.current) {
      localRef.current.srcObject = stream;
      localRef.current.play();
    }
    const track = stream.getVideoTracks()[0];
    setMediaParams(c => ({ ...c, track: track }));
    console.log("params has been set: ", localMediaParams);

  }

  useEffect(() => {
    if (device) {
      createProducerTransport();
    }

  }, [device])

  //------------------------when device gets loaded create a producer transport----------
  function createProducerTransport() {

    socket?.emit('createWebRTCTransport', async (callback: any) => {
      if (callback.success) {
        const transportParams: types.TransportOptions = callback.params;
        const prodTransport = device?.createSendTransport({
          id: transportParams.id,
          iceParameters: transportParams.iceParameters,
          iceCandidates: transportParams.iceCandidates,
          dtlsParameters: transportParams.dtlsParameters
        });
        setProducerTransport(prodTransport);


        prodTransport?.on('connect', (params, callback, errback) => {
          try {

            socket.emit('connect-transport', {
              transportId: prodTransport.id,
              dtlsParameters: params.dtlsParameters
            });
            callback();

          } catch (error: any) {
            alert(error)
            errback(error);

          }
        });

        prodTransport?.on('produce', ({ kind, rtpParameters }, callback, errback) => {

          try {
            socket.emit('produce', {
              rtpParameter: rtpParameters,
              kind,
              transportId: prodTransport.id
            }, (({ id }: { id: any }) => { callback(id); console.log(id); }))
          } catch (error: any) {
            alert(error);
            errback(error)
          }

        })
      }

    })
  }

  useEffect(() => {
    if (producerTransport && localMediaParams.hasOwnProperty('track')) {
      produceMedia();
    }

  }, [producerTransport, localMediaParams])

  //---------------------when producer tranport is made call produce to connect to server-------------
  async function produceMedia() {
    const producer = await producerTransport?.produce(localMediaParams);
    // console.log(producer);
    if(!producer) return;
    console.log("producer id in client producer:", producer.id);


    producer?.on('trackended', () => {
      console.log("track ended");
    })

    producer?.on('transportclose', () => {
      console.log('transport ended')

      // close video track
    })
  }


  useEffect(() => {
    if (allProducers) {

      allProducers.forEach(async (producer) => {
        createConsumerTransport()
          .then((newRecvTransport: any) => {

            console.log("Recv Transport", newRecvTransport);
            if (!newRecvTransport) return;
            consumeProducer(newRecvTransport, producer);
          })
      })

    }

  }, [allProducers])

  async function createConsumerTransport() {
    return new Promise((resolve, reject) => {

      socket?.emit('createWebRTCTransport', async (callback: any) => {
        if (callback.success) {
          const transportParams: types.TransportOptions = callback.params;
          const consTransport = device?.createRecvTransport({
            id: transportParams.id,
            iceParameters: transportParams.iceParameters,
            iceCandidates: transportParams.iceCandidates,
            dtlsParameters: transportParams.dtlsParameters
          });
          consumerTransports.set(consTransport?.id, consTransport);
          console.log("consumer tanpsort created :", consTransport);

          if (!consTransport) return;

          consTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              console.log("on connect called for recv trans");
              socket.emit('connect-transport', { dtlsParameters }, { transportId: consTransport.id });
              callback();

            } catch (error: any) {
              errback(error)

            }
          });

          resolve(consTransport)
        }
        else {
          reject();
          alert("Cannot create consumer trasnport");
        }
      })

    })

  }


  function consumeProducer(transportForConsumption: types.Transport, producer: string) {
    console.log("consume Producer called", transportForConsumption.id);
    
    socket?.emit('consume', 
      { rtpCapabilities: device?.rtpCapabilities, 
        producerId: producer, 
        transportId: transportForConsumption.id 
      },
      async (callback: any) => {
        if (callback.success) {
          const params: types.ConsumerOptions = callback.params;
          if (!params) return;
          console.log("Params in meeting received:", params);
          const consumer = await transportForConsumption.consume({
            id: params.id,
            rtpParameters: params.rtpParameters,
            kind: params.kind,
            producerId: params.producerId

          });
          const track = consumer.track;
          console.log("Inbound track: ",track);
          
          // const refId = remoteVideoBox.length;
          // remoteVideoRefs.current[refId] = React.createRef<HTMLVideoElement>()
          // const name = callback.params.name;
          // setRemoteVideoBox(prev => ([...prev, <VideoBox forwardedRef={remoteVideoRefs.current[refId]} name={name} key={refId}/>]));
         
          // if (remoteVideoRefs.current[refId] && remoteVideoRefs.current[refId].current) {
          //   console.log("track: ",track);
          //   (remoteVideoRefs.current[refId].current as HTMLVideoElement).srcObject = new MediaStream([track]);
          //   (remoteVideoRefs.current[refId].current as HTMLVideoElement).play();
          // }

          if(remoteRef.current){
            remoteRef.current.srcObject = new MediaStream([track]);
            remoteRef.current.play();
          }

          console.log("transport id:", params.id);
          
          socket.emit('consumer-resume',{transportId: params.id}, (callback:any)=>{
           console.log(callback);
           
          });


        }
        else{
          alert("Cannot consume producer");
        }

      })



  }











  return (
    <div className="relative w-full h-screen flex flex-col">

      <div className="flex h-[90%]">

        {/* localVideo */}
        <div className="localVideo inline-block m-3 ">
          <VideoBox forwardedRef={localRef} name={"You"} />
        </div>

        {/* Other Videos */}
        <div className="OtherVideos w-full  m-2 overflow-y-scroll flex flex-wrap gap-2 items-start">
          {/* <VideoBox forwardedRef={localRef} name={"You"}/> */}
          {/* {remoteVideoBox} */}
          <VideoBox forwardedRef={remoteRef} name={"remote"}/>


        </div>

      </div>

      <div className="footer   w-full border-t-[0.5px] border-slate-700 py-2 flex justify-center">
        <button className="py-2 px-4 border-2 border-red-500 text-red-500 rounded-lg">
          End Call
        </button>
      </div>
    </div>
  );
}

export default Meeting;













function VideoBox({ forwardedRef, name }: { forwardedRef: React.RefObject<HTMLVideoElement>, name: string }) {


  return (
    <div className="h-40 w-60 rounded-lg border-2 overflow-clip relative group" >
      <video ref={forwardedRef} className="w-full h-full bg-black object-cover"></video>
      <h2 className="absolute bottom-0 pl-3 group-hover:bg-gradient-to-b from-transparent to-slate-700 w-full">{name}</h2>
    </div>
  );
}
