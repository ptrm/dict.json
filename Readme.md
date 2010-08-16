# Dict.json – a dict protocol wrapper for node.js

## Description ##

Dict.json is a simple wrapper which requests definitions of given words from the dict server, and returns them in JSON format.
It tries hard to be RFC–compliant (http://www.dict.org/rfc2229.txt), though it can't be guaranteed.

Dict.json is distributed under a MIT-Style License.

### Currently supported actions ###
* getting definitions (also many words at a time)
* providing suggestions if the definition wasn't found

### Limitations (likely to be fixed soon) ###
* dict database is chosen at startup
* lack of support for listing databases and strategies
* Levenshtein strategy hardcoded for suggestions


## Usage ##

You should have node.js installed.

To run dict.json type `node dict.json.js`

The server should be up and listening on 127.0.0.1:8700

The program settings are stored in the config variable on the beginning of the dict.json.js file.
Best result are achieved when dict server is also run on localhost.


## Data structure ##

Currently there are two possible kinds of requests, for a single word or a list of them.
The only supported method is GET, but it might change in the future.

### Single word requests ###

#### Query string variables ####
* `mode=def` – can be ommited
* `suggestions=<true|false>`
* `word=<word>`
* `type=<adj|adv|v|n>` – Filtering only certain word types from the definition, currently unsupported.
		
#### Response ####
	{
		"definitions": [
			//Array is empty if no definitions
			{
				"def": "<definition>"
				"db": {
						"name": <database name>
						"desc": <database description>
				}
			},
			
			<more elements>
		],
		
		"suggestions": [ //if suggestions=true
			<suggested word 1>,
			<suggested word 2>
		],
		
		"status": <ok - also when no definitions found|error>
		"msg": <Status message>
	}
		
### Multiple words requests ###
#### Query string variables ####
* `mode=multi`
* `words[0][word]=<word>`
* `words[0][type]=<type>`
* `suggestions=<true|false>`
		
#### Response ####
	{
		"definitions": { // Contains keys of every word requested
			"<word 1>": [
				//Array is empty if no definitions
				{
					"def": "<definition>"
					"db": {
							"name": <database name>
							"desc": <database description>
					}
				},
				
				<etc.>
			],
			
			<etc.>
		},
		
		"suggestions": { // if suggestions=true
			"<word 1>": [
				<suggested word 1>,
				<suggested word 2>,
				<etc.>
			],
			
			<etc.>
		},
		
		"status": <"ok" – also when no definitions found|"error">
		"msg": <Status message>
	}