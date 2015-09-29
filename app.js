var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

// models

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/evaluator');

var JudgementSchema = new mongoose.Schema({ 
									version: String, 
									term: String, 
									good_votes: Number,
									bad_votes: Number,
									flags: [] 
								});
JudgementSchema.index({term:1,version:1},{unique:true});								
var Judgement = mongoose.model('Judgement', JudgementSchema);

var VersionSchema = new mongoose.Schema({
	name : { type : String , required : true },
	url : { type : String , required : true },
	notes: String
});
var Version = mongoose.model('Version', VersionSchema);


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.engine('html', require('ejs').renderFile);

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'semantic')));


// routes
app.get('/evaluate/:version', function(req, res, next) {
  res.render('evaluate.html', { title: 'Express', foo: 'bar', version: req.params.version });
});

app.post('/judgements/save', function(req, res) {
	for (idx in req.body.judgements) {
		var j = req.body.judgements[idx];
		console.log(j);
		var good_vote = (j.judgement == "GOOD") ? 1 : 0;
		var bad_vote = (j.judgement == "BAD") ? 1 : 0;
		var judgement = { 
									version: j.version, 									 
									term: j.term, 									
									$inc: { good_votes: good_vote, bad_votes: bad_vote },
									$addToSet: { flags: { $each:j.flags } }									
						};
		Judgement.findOneAndUpdate( { term: j.term, version: j.version}, judgement, { upsert:true, new:true}, 
			function (err,doc) {
	  			if (err) {
	  				console.log(err);
	  			}
		});
	}
	
	res.send(req.body);
});

app.get('/', function(req, res) {
	res.redirect('/versions');
});

app.get('/versions', function(req, res) {
	Version.find({ }).exec( 
					function (err, result) {
						if (err) {
							res.send(err);
						} else {
							res.render("versions.html", {});					
						}
    				});
});

app.get('/versions/all', function(req, res) {
	Version.find({ }).exec( 
					function (err, result) {
						if (err) {
							next(err);
						} else {
							res.header("Content-Type", "application/json; charset=utf-8");
							res.send(result);						
						}
    				});
});


app.post('/version/save', function(req, res) {
	var v = req.body.version;
	console.log(v);
	var version = {
					name: v.name,
					url: v.url,
					notes: v.notes
				};
	Version.findOneAndUpdate( { name: v.name }, version, {upsert:true, new:true, runValidators: true },function (err,doc) {
	  		if (err) {
	  			res.send(err);
	  		}
	  		console.log(doc);
	  		res.send(doc);
		});
});

app.post('/version/delete', function(req, res) {
	console.log(req.body);
	var v = req.body.version;
	Version.findOne( { name: v }).remove().exec(function (err, result) {
	  		if (err) {
	  			res.send(err);
	  		}
	  		res.send(result);
		});
});

app.get('/judgements/:version', function(req, res) {
	Judgement.find({version: req.params.version })
				.sort({ bad_votes : -1, good_votes : 1 } )
				.exec( 
					function (err, result) {
						if (err) {
							next(err);
						} else {
							res.header("Content-Type", "application/json; charset=utf-8");
							res.send(result);						
						}
    				});
});		

app.get('/report/:version', function(req, res, next) {
	Version.findOne({name: req.params.version }).exec( 
					function (err, result) {
						if (err) {
							console.log("ERROR");
						} else {
							console.log(result);
							if (result == null) {
								message = "version does not exist";
								res.render("report.html", { version: { 'name':'', 'notes':'', 'url':'' }, message: message });														
							} else {
								res.render("report.html", { version: result, message: '' });												
							}							
						}
    				});
});

app.get('/query/:version/:term', function(req, res) {
	var name = req.params.version;
	var term = req.params.term;
	
	Version.findOne({ name: name }).exec( 
					function (err, version) {
						if (err) {
							res.send(err);
						} else {
							console.log(version);							
							console.log(typeof version.url);

							var url = require('url');
							var solr = require('solr-client');
							var http = require('http');
							
							var parsed = url.parse(version.url);
							res.header("Content-Type", "application/json; charset=utf-8");
							term = term.replace(' ','+');
							
							var options = {
								host: parsed.hostname,
								port: parsed.port,
								path: parsed.pathname + parsed.search + term
							}
							
							http.request(options, function(response){
							  var str = '';

							  response.on('data', function (chunk) {
								str += chunk;
							  });

							  //the whole response has been recieved, so we just print it out here
							  response.on('end', function () {
								console.log(str);
								res.send(str);
							  });

							}).end();
	
						}
    				});
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}


// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
