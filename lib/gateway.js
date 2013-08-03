///////////////////////////////////////////////////
// most of this code was taken from
// https://github.com/TooTallNate/node-upnp-client
///////////////////////////////////////////////////

var url     = require("url"),
    http    = require("http");

const WANIP = "urn:schemas-upnp-org:service:WANIPConnection:1";
const SOAP_ENV_PRE = "<?xml version=\"1.0\"?>\n<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"><s:Body>";
const SOAP_ENV_POST = "</s:Body></s:Envelope>";

function Gateway(port, host, path) {
  this.port = port;
  this.host = host;
  this.path = path;
}

Gateway.prototype.addPortMapping = function(opts, callback) {
  if (!opts.external || !opts.internal || !opts.ip || !opts.name)
    throw('Missing keys.')

  this._getSOAPResponse(
    "<u:AddPortMapping \
    xmlns:u=\""+WANIP+"\">\
    <NewRemoteHost>" + (opts.remote_host || '') + "</NewRemoteHost>\
    <NewExternalPort>" + opts.external + "</NewExternalPort>\
    <NewProtocol>" + (opts.protocol || 'TCP') + "</NewProtocol>\
    <NewInternalPort>" + opts.internal + "</NewInternalPort>\
    <NewInternalClient>" + opts.ip + "</NewInternalClient>\
    <NewEnabled>1</NewEnabled>\
    <NewPortMappingDescription>" + opts.name + "</NewPortMappingDescription>\
    <NewLeaseDuration>" + (opts.duration || 0) + "</NewLeaseDuration>\
    </u:AddPortMapping>",
    "AddPortMapping",
    callback
  );
}

Gateway.prototype.deletePortMapping = function(opts, callback) {
  if (!opts.external)
    throw('Missing "external" key.')

  this._getSOAPResponse(
    "<u:DeletePortMapping \
    xmlns:u=\""+WANIP+"\">\
    <NewRemoteHost>" + (opts.remote_host || '') + "</NewRemoteHost>\
    <NewExternalPort>" + opts.external + "</NewExternalPort>\
    <NewProtocol>" + (opts.protocol || 'TCP') + "</NewProtocol>\
    </u:DeletePortMapping>",
    "DeletePortMapping",
    callback
  );
}

Gateway.prototype.getMapping = function(index, callback) {
  this._getSOAPResponse(
    "<u:GetGenericPortMappingEntry \
    xmlns:u=\""+WANIP+"\">\
    <NewPortMappingIndex>" + index + "</NewPortMappingIndex>\
    </u:GetGenericPortMappingEntry>",
    "GetGenericPortMappingEntry",
    callback
  );
}

Gateway.prototype.findMapping = function(opts, callback) {
  if (!opts.external)
    throw('Missing "external" key.');

  this._getSOAPResponse(
    "<u:GetSpecificPortMappingEntry \
    xmlns:u=\""+WANIP+"\">\
    <NewRemoteHost>" + (opts.remote_host || '') + "</NewRemoteHost>\
    <NewExternalPort>" + opts.external + "</NewExternalPort>\
    <NewProtocol>" + (opts.protocol || 'TCP') + "</NewProtocol>\
    </u:GetSpecificPortMappingEntry>",
    "GetSpecificPortMappingEntry",
    callback
  );
}

Gateway.prototype.getExternalIPAddress = function(callback) {
  this._getSOAPResponse(
    "<u:GetExternalIPAddress xmlns:u=\"" + WANIP + "\">\
    </u:GetExternalIPAddress>",
    "GetExternalIPAddress",
    callback
  );
}

Gateway.prototype._getSOAPResponse = function(soap, func, callback) {

  var self = this;
  var buff = new Buffer(SOAP_ENV_PRE + soap + SOAP_ENV_POST, 'utf8');

  var headers = {
    'Host'           : this.host + (this.port != 80 ? ":" + this.port : ""),
    'SOAPACTION'     : '"' + WANIP + '#' + func + '"',
    'Content-Type'   : 'text/xml',
    'Content-Length' : buff.length
  }

  var opts = {
    host: this.host,
    port: this.port,
    method: 'POST',
    path: this.path,
    headers: headers
  }

  var request = http.request(opts, function(response){
    if (response.statusCode === 402) {
      return callback && callback.call(self, new Error("Invalid Args"));
    } else if (response.statusCode === 501) {
      return callback && callback.call(self, new Error("Action Failed"));
    }

    response.body = '';
    response.setEncoding("utf8");
    response.on('data', function(chunk) { response.body += chunk });
    response.on('end', function() {
      callback && callback.call(self, null, response);
    });
  });

  request.on('error', function(error) {
    callback && callback.call(self, error);
  });

  request.end(buff);
}

module.exports = Gateway;
