var entry = require('./../lib');

entry.exists({ external: process.argv[2] || 5555 }, function(err, mapping){

  if (err)
    console.log(err);
  else if (!mapping)
    console.log('Available!');
  else if (mapping.mine)
    console.log('Already mapped to me!\n', mapping);
  else
    console.log('Mapped to someone else.\n', mapping)

})
