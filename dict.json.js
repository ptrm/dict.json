/*
	Dict.json, a dict protocol wrapper
	Copyright (c) 2010 Piotrek Marciniak, MIT Style License
*/

var http = require('http');
var sys = require('sys');
var url = require('url');
var querystring = require('querystring');
var net = require('net');
//var XRegExp = require('./xregexp');

//only for validating types in request
var wordTypes = {'adj':'', 'adv':'', 'v':'', 'n':''};

var logLevel = {
				  'silent' : 0
				, 'standard' : 1
				, 'diagnostic' : 2
				, 'verbose' : 3
}

var config = {
				  logging : logLevel.standard
				, server : {
							  'port' : '8700'
							, 'host' : '127.0.0.1'
					}
				, dictd : {
							 'port' : '2628'
							, 'host' : '127.0.0.1'
					}
				, db : 'wn'
}

start();

function start() {
	sys.log('Dict.json started');
	
	server = http.createServer(handleRequest);
	
	server.listen(config.server.port, config.server.host);
	
};



function handleRequest(req, res) {
	
	log('New connection');
	
	req.setEncoding('utf8');
	params = url.parse(req.url, true).query;
	
	res.writeHead(200, {'Content-Type': 'application/json'});
	
	var mode = '';
	
	var wordList = [];

	if (params) {
		if (params.mode == null)
			params.mode = '';
		
		switch ( params.mode ) {
			case '':
			case 'def':
				wordList = [ {word: params.word, type: params.type} ];
				mode = 'def';
			break;
			
			case 'multi':
				wordList = params.words;
				mode = 'multi';
			break;
		
			default:
				end(res, 'error', 'Wrong mode given.');
				return;
			break;
		}
	}
	else {
		end(res, 'error', 'No parameters supplied.');
		return;
	}
	
	words = parseWords(wordList);

	if (words._count) {
		log('Words ok', logLevel.verbose);
		defs = getDefs(words, res, {
									  mode: mode
									, suggestions: (params.suggestions == 'true')
				});
	}
	else
		end(res, 'error', 'No words provided.');
	
	//log(sys.inspect(url.parse(params, true), true));
}

function end(stream, status, msg, data) {
	if (data == null)
		data = {};

	data['status'] = status;
	data['msg'] = msg;
	
	stream.end(JSON.stringify(data));
}

function getDefs(words, res, options) {
	var defs = {};
	var suggestions = {};
	var reqQueue = [];
	var currentReq = {};
	
	dict = net.createConnection(config.dictd.port, config.dictd.host );
	
	dict.setTimeout(100);
	dict.setEncoding('utf8');
	
	if ( typeof options != 'object' )
		options = {};
	
	dict.on('timeout', function () {
		log('timeout', logLevel.diagnostic);
		dict.end();
	});
	
	dict.on('end', function() {
		log('end', logLevel.diagnostic);
		dict.end();
	});
	
	dict.on('connect', function () {
		log('getDefs: connected', logLevel.verbose);
		
		//we wait for a full response before requesting another definition
		for (var word in words) {
			if (word == '_count')
				continue;
			
			var req = 'd ' + config.db +' "' + word + '"' + "\r\n";
			
			defs[word] = [];
			
			reqQueue.push({
							  request: req
							, word: word
							, type: 'def'
						});
			
			//reqQueue.push('d * "' + word + '"' + "\r\n");
		}
	});
	
	var reqOnDrain = false;
	
	function nextReq() {
		reqOnDrain = false;

		if ( reqQueue.length ) {
			if ( dict.writable == false ) {
				reqOnDrain = true;
				log('nextReq() postponed till drain', logLevel.diagnostic);
				return;
			}
			
			currentReq = reqQueue.shift();
			dict.write(currentReq.request);
			
			log('getDefs: nextReq: sent request: "' + currentReq.request + '"', logLevel.verbose);
		}
		else {
			currentReq = {request: 'q\r\n'};
			dict.end(currentReq.request);
			log('nextReq(): Sent "q"', logLevel.diagnostic);
		}
	}
	
	dict.on('drain', function() {
		if ( ! reqOnDrain )
			return
			
		nextReq();
		log('called nextReq() on drain', logLevel.diagnostic);
	});
	
	var textBuf = '';
	var textEnded = true;
	var word = '';
	var dbDesc = '';
	var dbName = '';
	var status = '';
	
	dict.on('data', function (data) {
		if (typeof data != 'string')
			return;
		
		log('Data: ' + JSON.stringify(data), logLevel.verbose);

		var nextResponsePos = -2;
		var response = '';
		
		function nextResponse() {
			if ( textEnded ) {
				nextResponsePos = data.search(/\r\n[0-9]{3}/);		
			}
			else {
				nextResponsePos = data.search(/\r\n\.(\r\n|$)/);
			}
				
			if (nextResponsePos != -1) {
				response = data.substring(0, nextResponsePos);
				// + 2 for \r\n
				data = data.slice(nextResponsePos + 2);
			}
			else
				response = data;

			if ( textEnded ) {
				status = response.substring(0,3);	
			}
			else {
				textEnded = ( nextResponsePos > -1 );
				log('nextResponsePos: ' + nextResponsePos, logLevel.verbose);
			}
			
			log('Response: "' + response + '", next at ' + nextResponsePos, logLevel.verbose);

			log('Status: ' + status, logLevel.verbose);
		}
		
		//silly workaround to avoid infinite loops
		//this won't take more than a fraction of second, and we surely won't parse million responses.
		var loopCount = 1000000;
		
		while ( (nextResponsePos != -1) && (nextResponsePos != 0) && loopCount > 0) {
			loopCount--;
			
			if (loopCount == 1) {
				log('Loop warning.', log.standard);
			}
			
			if (textEnded) {
				textBuf = '';
				status = '';
				response = '';
				nextResponse();
			}
			else {
				log('Continuing previous data', logLevel.verbose);
			}
			


			switch (status) {
				//greetings
				case '220':
					log('getDefs: dict.org said hello', logLevel.verbose);
					
					//we can start the fun now
					nextReq();
				break;
				
				//bye
				case '221':
					log('getDefs: dict.org says bye', logLevel.verbose);
					//onEnd event should follow, so no need to do anything here
				break;
					
				//invalid database, nothing more to do
				case '550':
					dict.destroy();
					end(res, 'error', 'Invalid database.');
					return;
				break;
				
				//a couple of errors on which we should close
				//temorarily unavailable
				case '420':
				//shutting down
				case '421':
					end(res, 'error', 'Error code ' + status);
					return;
				break;
				
				//no match
				case '552':
					//provide suggestions?
					//checking request type, because server gives the same not found code for suggestions as for words;
					if ( (currentReq.type == 'def') && options.suggestions ) {
						reqQueue.push({
										  request: 'match ' + config.db + ' lev "' + currentReq.word + '"' + '\r\n'
										, type: 'sug'
										, word: currentReq.word
									});
					}
					nextReq();
				break;
				
				//a couple of errors on which we might try to continue
				//syntax error, command not recognized
				case '500':
				//syntax error, wrong parameters
				case '501':
				//command parameter not implemented
				case '503':
				//invalid strategy
				case '551':
					log('Proceeding to next request at status ' + status, logLevel.diagnostic);
					nextReq();
				break;
				
				//suggestions
				case '152':
					word = currentReq.word;
					
					if (textEnded) {
						//first line is the status message:
						idx = response.indexOf('\r\n');
						if (idx == -1)
							break;
						
						header = response.substring(0, idx);
						response = response.slice(idx+2);
						
						textBuf = response;
						
						textEnded = response.match(/\r\n\.(\r\n|$)/);
						
						if ( !textEnded ) {
							log("Suggestions didn't end.", logLevel.verbose);
						}
					}
					else {
						nextResponse();
						
						textBuf = textBuf.concat(response);
					}
						
					if (textEnded) {
						// ".." On the beggining of a new line means "."
						// We also remove the "." ending the text message.
						
						sugLines = textBuf.replace(/\r\n\.(\r\n|$)/, '').split('\r\n');
						
						suggestions[word] = [];
						
						for (lNum in sugLines) {
							if ( ! sugLines[lNum].trim() )
								continue;
							
							sug = sugLines[lNum].replace(/^[a-zA-Z0-9]+ "([^"]+)".*/, '$1');
						
							log('Suggestion: "' + sug + '"', logLevel.verbose);
						
							suggestions[word].push(sug);
						}
						
						log('Suggestions ended.', logLevel.verbose);
						log('Parsed suggestions: ' + sys.inspect(suggestions[word]), logLevel.verbose);
					}
				break;
				
				//ok
				case '250':
					nextReq();
				break;
				
				//definition
				case '151':
					//textEnded, so we are free to start anew
					if ( textEnded ) {
						//first line is the status message:
						idx = response.indexOf('\r\n');
						if (idx == -1)
							break;
						
						header = response.substring(0, idx);
						response = response.slice(idx+2);
						
						word = header.replace(/[0-9]{3} "([^"]*)".*/, '$1').toLowerCase();
						dbName = header.replace(/[0-9]{3} "[^"]*" (\w+)\b.*/, '$1');
						dbDesc = header.replace(/[0-9]{3} "[^"]*".*"([^"]*)"/, '$1');
	
						textBuf = response;
						
						textEnded = response.match(/\r\n\.(\r\n|$)/);
						if ( !textEnded ) {
							log("Definition didn't end.", logLevel.verbose);
						}
					}
					else {
						nextResponse();
						
						textBuf = textBuf.concat(response);
					}
					
					if (textEnded) {
						// ".." On the beggining of a new line means "."
						// We also remove the "." ending the text message.
						definition = textBuf.replace(/^\.\./m, '.').replace(/\r\n\.(\r\n|$)/, '');
						
						log('Definition ended.', logLevel.verbose);
						log('Parsed defs: ' + sys.inspect(definition), logLevel.verbose);
						
						if (typeof defs[word] != 'array')
							defs[word] = new Array();
						
						defs[word].push({
											  def: definition
											, db: {
												  name:dbName
												, desc: dbDesc
											}
										});
						
						log('Defs: ' + sys.inspect(defs), logLevel.verbose);
					}
				break;
			}
		
			log("*** End of data event\n", logLevel.verbose);
		}
		
	});
		
	dict.on('close', function (ok) {
		if (options.mode == 'def') {
			defs = defs[word] || [];

			if (options.suggestions)
				suggestions = suggestions[word] || [];
		}
		
		
		data = { 'definitions': defs }
		
		if ( options.suggestions )
			data['suggestions'] = suggestions;
		
		end(res, 'ok', '', data);
		log('Connection ended.', logLevel.verbose);
	});
}

function parseWords(words) {
	res = {};
	count = 0;
	
	for (i in words) {
		if ( typeof words[i].word != 'string' )
			continue;
		
		word = words[i].word.replace(/["\r\n]/g, '').trim().toLowerCase();
		type = (words[i].type in wordTypes) ? words[i].type : '';
		
		if ( word ) {
			res[word] = type;
			count++;
		}
	}
	
	res._count = count;
	
	log(sys.inspect(res), logLevel.verbose);
	
	return res;
}

function log(msg, level) {
	if (level == null)
		level = logLevel.standard;

	if (level <= config.logging)
		sys.log(msg);
}