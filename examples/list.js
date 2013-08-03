var entry = require('./../lib');

entry.list(function(err, list){
  if (err)
    return console.log(err);

  console.log('Got ' + list.length + ' mappings.')
  console.log(list);
})


