var dgram = require('dgram');
var execFile = require('child_process').execFile;

var events = require('events');
var util = require('util');

SSDP = function SSDP() {
	if (!(this instanceof SSDP)) return new SSDP();

	events.EventEmitter.call(this);

	var SSDP_SIG = 'Microsoft-Windows-NT/5.1 UPnP/1.1 Mediabrary/1.0';
	var SSDP_IP = '239.255.255.250';
	var SSDP_PORT = 1900;
	var SSDP_IPPORT = SSDP_IP+':'+SSDP_PORT;
	var TTL = 1800;

	this.usns = {};
	this.udn = 'uuid:e3f28962-f694-471f-8f74-c6abd507594b';

	// Configure socket for either client or server.
	this.sock = dgram.createSocket('udp4');
	this.sock.on('error', function () {
		console.log('############### Got an error!');
	});

	this.sock.on('message', function onMessage(msg, rinfo) {
		this.parseMessage(msg, rinfo);
	}.bind(this));

	this.sock.on('listening', function onListening() {
		var addr = this.sock.address();
		console.log('SSDP Listening on '+addr.address+':'+addr.port);
		this.sock.addMembership(SSDP_IP);
		this.sock.setMulticastTTL(2);
	}.bind(this));

	this.inMSearch = function (st, rinfo) {
		var peer = rinfo['address'];
		var port = rinfo['port'];

		if (st[0] == '"') st = st.slice(1, -1);

		for (usn in this.usns) {
			udn = this.usns[usn];

			if (st == 'ssdp:all' || usn == st) {
				var pkt = this.getSSDPHeader('200 OK', {
					ST: usn,
					USN: udn,
					LOCATION: this.httphost+'/upnp/desc.php',
					'CACHE-CONTROL': 'max-age='+TTL,
					DATE: new Date().toUTCString(),
					SERVER: SSDP_SIG,
					EXT: ''
				}, true);
				console.log('Sending a 200 OK for an m-search to '+peer+':'+port);
				pkt = new Buffer(pkt);
				this.sock.send(pkt, 0, pkt.length, port, peer);
			}
		}
	}

	process.on('exit', function () { this.close; } );

	this.addUSN = function (device) {
		this.usns[device] = this.udn+'::'+device;
	}

	this.parseMessage = function (msg, rinfo) {
		var type = msg.toString().split('\r\n').shift();

		// HTTP/#.# ### Response
		if (type.match(/HTTP\/(\d{1})\.(\d{1}) (\d+) (.*)/))
			this.parseResponse(msg, rinfo);
		else
			this.parseCommand(msg, rinfo);
	}

	this.parseResponse = function parseResponse(msg, rinfo) {
		this.emit('response', msg, rinfo);
		/*console.log('Parsing a response!');
		console.log(msg.toString());*/
	}

	this.search = function search(st) {
		require('dns').lookup(require('os').hostname(), function (err, add) {
		  console.log('Address: ' + add);
			// this.sock.bind(0, add);

			var pkt = this.getSSDPHeader('M-SEARCH', {
				HOST: SSDP_IPPORT,
				ST: st,
				MAN: '"ssdp:discover"',
				MX: 3
			});
			pkt = new Buffer(pkt);
			console.log(pkt.toString());
			this.sock.send(pkt, 0, pkt.length, SSDP_PORT, SSDP_IP);
		}.bind(this));
	}

	this.server = function (ip) {
		this.httphost = 'http://'+ip+':10293';

		this.usns[this.udn] = this.udn;

		this.sock.bind(SSDP_PORT, ip);

		// Shut down.
		this.advertise(false);
		setTimeout(this.advertise.bind(this), 1000, false);

		// Wake up.
		setTimeout(this.advertise.bind(this), 2000);
		setTimeout(this.advertise.bind(this), 3000);

		// Ad loop.
		setInterval(this.advertise.bind(this), 10000);
	}

	this.close = function () {
		this.advertise(false);
		this.advertise(false);
		this.sock.close();
	}

	this.advertise = function (alive) {
		if (!this.sock) return;
		if (alive == undefined) alive = true;

		for (usn in this.usns) {
			udn = this.usns[usn];

			var out = 'NOTIFY * HTTP/1.1\r\n';
			heads = {
				HOST: SSDP_IPPORT,
				NT: usn,
				NTS: (alive ? 'ssdp:alive' : 'ssdp:byebye'),
				USN: udn
			}
			if (alive) {
				heads['LOCATION'] = this.httphost+'/upnp/desc.php';
				heads['CACHE-CONTROL'] = 'max-age=1800';
				heads['SERVER'] = SSDP_SIG;
			}
			out = new Buffer(this.getSSDPHeader('NOTIFY', heads));
			this.sock.send(out, 0, out.length, SSDP_PORT, SSDP_IP);
		}
	}

	this.getSSDPHeader = function (head, vars, res) {
		if (res == undefined) res = false;
		if (res) ret = "HTTP/1.1 "+head+"\r\n";
		else ret = head+" * HTTP/1.1\r\n";
		for (n in vars) ret += n+": "+vars[n]+"\r\n";
		return ret+"\r\n";
	}
}

util.inherits(SSDP, events.EventEmitter);
exports.SSDP = SSDP;
