var entry    = require('./../lib');

var external = process.argv[2] || 5555,
    internal = process.argv[3] || external;

entry.map({
  external: external,
  internal: internal,
  name: 'My app'
}, function(err){
  if (err)
    console.log(err);
  else
    console.log('Successfully mapped external port ' + external + ' to ' + internal);
})


