var os = require('os');

exports.private_ips = function(cb){
  var ips = [],
      nics = os.networkInterfaces();

  for (var name in nics) {
    if (name.indexOf('lo') == -1) {
      nics[name].forEach(function(v){
        if (v.family == 'IPv4')
          ips.push(v.address);
      })
    }
  }

  if (ips.length == 0)
    cb(new Error('No private IP addresses found.'));
  else
    cb(null, ips);
}
