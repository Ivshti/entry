///////////////////////////////////////////////////
// most of this code was taken from
// https://github.com/TooTallNate/node-upnp-client
///////////////////////////////////////////////////

'use strict';

var dgram = require('dgram')
  , EE = require('events').EventEmitter
  , util = require('util')
;

var SSDP_SIG = 'node.js/0.0.8 UPnP/1.1 node-ssdp/0.0.1'
  , SSDP_IP = '239.255.255.250'
  , SSDP_PORT = 1900
  , SSDP_IPPORT = SSDP_IP + ':' + SSDP_PORT
  , TTL = 1800;

var logger = {
  out     : console.log
, error   : function(msg, props) { this.out(msg); this.out(props.stack); }
, info    : function(msg, props) { this.out(msg); if (props) this.out(props);  }
, debug   : function(msg, props) { if (process.env.DEBUG) this.out(msg) }
}

function SSDP() {
  var self = this;

  if (!(this instanceof SSDP)) return new SSDP();

  EE.call(self);

  self.logger = logger;
  self.description = 'upnp/desc.php';

  self.usns = {};
  self.udn = 'uuid:e3f28962-f694-471f-8f74-c6abd507594b';

  // Configure socket for either client or server.
  self.listening = false;
  self.responses = {};
  self.sock = dgram.createSocket('udp4');

  self.sock.on('error', function(err) {
    self.emit('error', err);
    self.logger.debug('ssdp', { event: 'socket', diagnostic: 'error', exception: err });
  });

  self.sock.on('message', function(msg, rinfo) {
    self.parseMessage(msg, rinfo);
  });

  self.sock.on('listening', function() {
    var addr = self.sock.address();
    try {
      self.sock.addMembership(SSDP_IP);
      self.listening = 'http://' + addr.address + ':' + addr.port;
      self.logger.debug('SSDP listening on ' + self.listening);
    } catch(e) {
      self.listening = false;
      self.sock.emit('error', e);
    }
//    self.sock.setMulticastTTL(2);
  });

  process.on('exit', function () {
    if (!self.closed) self.close();
  });
}

util.inherits(SSDP, EE);

SSDP.prototype.inMSearch = function (st, rinfo) {
  var self = this
    , peer = rinfo['address']
    , port = rinfo['port'];

  if (st[0] == '"') st = st.slice(1, -1);

  Object.keys(self.usns).forEach(function (usn) {
    var udn = self.usns[usn];

    if (st == 'ssdp:all' || usn == st) {
      var pkt = self.getSSDPHeader('200 OK', {
        ST: usn,
        USN: udn,
        LOCATION: self.httphost + '/' + self.description,
        'CACHE-CONTROL': 'max-age=' + TTL,
        DATE: new Date().toUTCString(),
        SERVER: SSDP_SIG,
        EXT: ''
      }, true);
      self.logger.debug('Sending a 200 OK for an m-search to ' + peer + ':' + port);
      pkt = new Buffer(pkt);
      self.sock.send(pkt, 0, pkt.length, port, peer);
    }
  });
};

SSDP.prototype.addUSN = function (device) {
  this.usns[device] = this.udn + '::' + device;
};

SSDP.prototype.parseMessage = function (msg, rinfo) {
  var type = msg.toString().split('\r\n').shift();

  // HTTP/#.# ### Response
  if (type.match(/HTTP\/(\d{1})\.(\d{1}) (\d+) (.*)/)) {
    this.parseResponse(msg, rinfo);
  } else {
    this.parseCommand(msg, rinfo);
  }
};

SSDP.prototype.parseCommand = function parseCommand(msg, rinfo) {
  var lines = msg.toString().split("\r\n")
    , type = lines.shift().split(' ')
    , method = type[0]
    , self = this;

  var heads = {};

  lines.forEach(function (line) {
    if (line.length) {
      var vv = line.match(/^([^:]+):\s*(.*)$/);
      heads[vv[1].toUpperCase()] = vv[2];
    }
  });

  switch (method) {
    case 'NOTIFY':
      // Device coming to life.
      if (heads['NTS'] == 'ssdp:alive') {
        self.emit('advertise-alive', heads);
      }
      // Device shutting down.
      else if (heads['NTS'] == 'ssdp:byebye') {
        self.emit('advertise-bye', heads);
      } else {
        self.logger.warning('NOTIFY unhandled', { msg: msg, rinfo: rinfo });
      }
      break;
    case 'M-SEARCH':
      logger.debug('SSDP M-SEARCH: for (' + heads['ST'] + ') from (' + rinfo['address'] + ':' + rinfo['port'] + ')');
      if (!heads['MAN']) return;
      if (!heads['MX']) return;
      if (!heads['ST']) return;
      self.inMSearch(heads['ST'], rinfo);
      break;
    default:
      self.logger.warning('NOTIFY unhandled', { msg: msg, rinfo: rinfo });
  }
};

SSDP.prototype.parseResponse = function parseResponse(msg, rinfo) {
  if (!this.responses[rinfo.address]) {
    this.responses[rinfo.address] = true;
    this.logger.debug('SSDP response', { rinfo: rinfo });
  }
  this.emit('response', msg, rinfo);
};

SSDP.prototype.search = function search(st) {
  var self = this;

  require('dns').lookup(require('os').hostname(), function (err, add) {/* jshint unused: false */
    if (process.platform == 'win32')
      self.sock.bind(0, add);

    var pkt = self.getSSDPHeader('M-SEARCH', {
      'HOST': SSDP_IPPORT,
      'ST': st,
      'MAN': '"ssdp:discover"',
      'MX': 3
    });

    pkt = new Buffer(pkt);
    self.logger.debug(pkt.toString());
    self.sock.send(pkt, 0, pkt.length, SSDP_PORT, SSDP_IP);
  });
};

SSDP.prototype.close = function () {
  this.advertise(false);
  this.advertise(false);
  if (this.listening)
    this.sock.close()
  this.closed = true;
};

SSDP.prototype.advertise = function (alive) {
  var self = this;

  if (!this.sock) return;
  if (alive === undefined) alive = true;

  Object.keys(self.usns).forEach(function (usn) {
    var udn = self.usns[usn]
      , out = 'NOTIFY * HTTP/1.1\r\n';

    var heads = {
      HOST: SSDP_IPPORT,
      NT: usn,
      NTS: (alive ? 'ssdp:alive' : 'ssdp:byebye'),
      USN: udn
    };

    if (alive) {
      heads['LOCATION'] = self.httphost + '/' + self.description;
      heads['CACHE-CONTROL'] = 'max-age=1800';
      heads['SERVER'] = SSDP_SIG;
    }

    out = new Buffer(self.getSSDPHeader('NOTIFY', heads));
    self.sock.send(out, 0, out.length, SSDP_PORT, SSDP_IP);
  });
};

SSDP.prototype.getSSDPHeader = function (head, vars, res) {
  var ret = '';

  if (res === null) res = false;

  if (res) {
    ret = "HTTP/1.1 " + head + "\r\n";
  } else {
    ret = head + " * HTTP/1.1\r\n";
  }

  Object.keys(vars).forEach(function (n) {
    ret += n + ": " + vars[n] + "\r\n";
  });

  return ret + "\r\n";
};

module.exports = SSDP;
