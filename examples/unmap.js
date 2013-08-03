var entry    = require('./../lib');

var external = process.argv[2] || 5555,
    internal = process.argv[3] || external;

entry.unmap({
  external: external,
}, function(err){
  if (err)
    console.log(err);
  else
    console.log('Successfully unmapped external port ' + external);
})


