var Gateway   = require('./gateway'),
    SSDP      = require('./ssdp'),
    xml2js    = require('xml2js'),
    needle    = require('needle'),
    url_parse = require('url').parse;

var gw,
    private_ip,
    search_timeout = 10000;

var debug = function(str, obj){
  if (process.env.DEBUG)
    console.log(str) || obj && console.log(obj)
}

var matches = function(obj, conditions) {
  for (var key in obj){
    if (conditions[key] && conditions[key] == obj[key])
      return true;
  }
  return false;
}

var parseResponse = function(str){
  var obj = {};
  str.toString().split('\n').forEach(function(line){
    var match = line.match(/:(.+)/);
    if (!match || !match[1]) return;

    obj[line.split(':')[0].toLowerCase()] = match[1]
  })
  return obj;
}

var parseMapping = function(xml, type, cb){
  xml2js.parseString(xml, { explicitArray: false }, function(err, res){
    if (err) return cb(err);

    var soap_body = res['s:Envelope']['s:Body'];
    if (!soap_body[type])
      return cb(new Error('Not found.'));

    delete(soap_body[type]['$'])
    return cb(null, soap_body[type])
  })
}

var getPrivateIP = function(cb){
  if (private_ip)
    return cb(null, private_ip);

  require('dns').resolve(require('os').hostname(), function(err, res){
    if (!err) return cb(null, res);

    // dns lookup failed, so lets use the os.networkInterfaces method
    require('./nic').private_ips(function(err, ips){
      if (err || !ips[0])
        return cb(err || new Error('Unable to find private IP.'));
      else if (!gw)
        return cb(null, ips[0])

      var gw_base = gw.host.match(/(.*)\.(\d+)/)[1];

      var active = ips.filter(function(ip){
        if (ip.match(/(.*)\.(\d+)/)[1].indexOf(gw_base) != -1)
          return ip;
      })[0];

      cb(null, active);
    });
  });
}
var possibleArray = function(obj) { return obj.length ? obj : [obj] };
var getControlURL = function(url, cb){
  needle.get(url, function(err, resp, body){
    try {
      var control_url;
      possibleArray(body.root.device.deviceList.device).forEach(function(dev) {
        // console.log(dev);
        if (dev.deviceType == 'urn:schemas-upnp-org:device:WANDevice:1') {
            var service = dev.deviceList.device.serviceList.service;
            list = service[0] ? service : [service];
            list.forEach(function(s){
              if (s.serviceType == 'urn:schemas-upnp-org:service:WANIPConnection:1')
                control_url = s.controlURL;
            });
        }
      })
      cb(null, control_url);
    } catch(e) {
      cb(e);
    }
  })
}

var findGateway = function(cb){
  if (gw)
    return cb();

  var timer,
      returned,
      client = new SSDP;

  var finish = function(err){
    if (returned) return;
    clearTimeout(timer);
    client.close();
    cb(err)
    returned = true;
  }

  client.on('response', function(msg, rinfo) {
    debug(rinfo, msg.toString());
    var data = parseResponse(msg);

    if (!data.location)
      return finish(new Error('Unable to get query URL for gateway.'));

    var server = url_parse(data.location);
    debug('Gateway responded! Querying at ' + server.host);

    getControlURL(data.location, function(err, path){
      if (err || !path) return finish(err ||  new Error('Could not find gateway control URL.'));

      debug('Initializing gateway: ' + rinfo.address + ':' + server.port + path);
      gw = new Gateway(server.port, rinfo.address, path);
      finish();
    });
  });

  client.on('error', finish);
  client.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1');

  timer = setTimeout(function(){
    finish(new Error('Could not locate gateway on time.'))
  }, search_timeout);

}

exports.list = function(cb){
  findGateway(function(err){
    if (err) return cb(err);

    var error,
        returned,
        count = 0,
        list = [],
        type = 'u:GetGenericPortMappingEntryResponse';

    var done = function(err){
      if (err) error = err;
      // cb(err, list);
      cb(null, list);
    }

    var get = function(i){
      if (error) return;

      gw.getMapping(i, function(err, res){
        if (err) return done(err);

        parseMapping(res.body, type, function(err, obj){
          if (err) return done(err);

          list.push(obj);
          get(++i);
        });
      });

    }

    get(0)
  })
}

/*
exports.find = function(opts, cb){
  var found = null;

  exports.list(function(err, list){
    if (err) return cb(err);
    if (list.length == 0) return cb();

    list.forEach(function(mapping){
      if (matches(mapping, opts))
        found = mapping;
    })

    cb(null, found);
  })
}
*/

exports.mine = function(cb){

  var mine = [];

  exports.list(function(err, list){
    if (err) return cb(err);

    getPrivateIP(function(err, ip){
      if (err) return cb(err);

      list.forEach(function(mapping){

        if (mapping.NewInternalClient == ip)
          mine.push(mapping);
      });

      cb(null, mine);
    });

  });

};

exports.exists = function(opts, cb){
  findGateway(function(err){
    if (err) return cb(err);

    gw.findMapping(opts, function(err, resp){
      if (err) return cb(err);

      var type = 'u:GetSpecificPortMappingEntryResponse';
      parseMapping(resp.body, type, function(err, obj){
        if (!obj) return cb();

        // check whether this mapping points to me or not
        getPrivateIP(function(err, ip){
          obj.mine = (ip && obj.NewInternalClient == ip);
          cb(null, obj);
        });

      });
    });
  })
}

exports.map = function(opts, cb){

  exports.exists(opts, function(err, mapping){
    if (err || mapping) return cb(err || new Error('Already mapped.'));

    // at this point we should have a valid gateway, so dont findGateway again.
    getPrivateIP(function(err, private_ip){
      if (err) return cb(err);

      opts.ip = private_ip;
      gw.addPortMapping(opts, cb);
    })
  });

}

exports.unmap = function(opts, cb){
  findGateway(function(err){
    if (err) return cb(err);
    gw.deletePortMapping(opts, cb);
  })
}


exports.ip = function(cb){
  findGateway(function(err){
    if (err) return cb(err);

    gw.getExternalIPAddress(function(err, resp){
      if (err) return cb(err);

      var ip = resp.body.match(/<NewExternalIPAddress>([^<]+)</)[1];
      cb(null, ip);
    });
  })
}
