var solr = require('solr-client')

var client = solr.createClient();

var query = 'q=*:*';
client.get('cwl', query, function(err, obj){
	if(err){
		console.log(err);
	}else{
		console.log(obj);
	}
});