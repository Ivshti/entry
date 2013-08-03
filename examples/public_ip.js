var entry = require('./../lib');

entry.ip(function(err, ip){
  console.log(err || ip);
})
