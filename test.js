var SSDP = require('./ssdp').SSDP;
var client = new SSDP;

client.on('notify', function () {
  console.log('Got a notification.');
});

client.on('response', function inResponse(msg, rinfo) {
  console.log('Got a response to an m-search.');
  console.log(msg.toString());
});

// client.search('urn:schemas-upnp-org:service:ContentDirectory:1');
client.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1');
// client.search('ssdp:all');
