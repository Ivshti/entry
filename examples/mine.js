var entry = require('./../lib');

entry.mine(function(err, list){
  if (err)
    return console.log(err);

  console.log('Got ' + list.length + ' mappings for this node.')
  console.log(list);
})
