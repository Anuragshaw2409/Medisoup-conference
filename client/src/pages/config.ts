export const params ={
    encodings: [
      {
        rid: 'r0',
        maxBitrate: 100000,
        //scaleResolutionDownBy: 10.0,
        scalabilityMode: 'S1T3'
      },
      {
        rid: 'r1',
        maxBitrate: 300000,
        scalabilityMode: 'S1T3'
      },
      {
        rid: 'r2',
        maxBitrate: 900000,
        scalabilityMode: 'S1T3'
      }
    ],
      // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
      codecOptions: {
        videoGoogleStartBitrate: 1000
      }
};
