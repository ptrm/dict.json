# Dict.json – a dict protocol wrapper for [node.js](http://nodejs.org/)

## Description ##

Dict.json is a simple wrapper which requests definitions of given words from the dict server, and returns them in JSON format.
It tries hard to be [RFC](http://www.dict.org/rfc2229.txt)–compliant, though it can't be guaranteed.

Dict.json is distributed under a MIT-Style License.

### Currently supported actions ###
* getting definitions (many words and databases at a time)
* providing suggestions if the definition wasn't found

### Limitations (likely to be fixed soon) ###
* lack of support for custom match command (used only for suggestions), listing databases and strategies
* Levenshtein distance one strategy hardcoded for suggestions


## Usage ##

You should have [node.js](http://nodejs.org/) installed.

To run dict.json type `node dict.json.js`

The server should be up and listening on `127.0.0.1:8700`.
The settings are stored in the `config` variable on the beginning of the `dict.json.js` file.
Best results are achieved when dict server is also run on localhost, otherwise you might want to change `config.dictd.timeout` to a greater value.


## Data structure ##

Currently there are two possible kinds of requests, for one and for many words.
The only supported method is GET, but it might change in the future.

### Single word requests ###

#### Query string variables ####
* `action=def` – optional, specifies the action to perform
* `word=<word>` – without the `"`, `\r` and `\n` characters, otherwise they will be cut and the returning definition key name will differ.
* `type=<adj|adv|v|n>` – optional, filtering only specified word type from the definition, currently unsupported.
* `db[]=<db name>` – optional, databases to use when searching. Can be a string (`db=<db name>`) if only one is specified.
* `suggestions=<true|default false>` – optional, look for suggestions if no definitions were found.
* `sug_ignore_db[]=<db name>` – optional, databases which won't be used for suggestions, can be a string if only one specified.

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
		
		"status": <ok - also when no definitions found|error>,
		
		"msg": <Status message>
	}

### Multiple words requests ###
#### Query string variables ####
* `action=multi`
* `words[0][word]=<word>`, as mentioned above
* `words[0][type]=<adj|adv|v|n>`
* `words[0]db[]=<db name>`
* `suggestions=<true|false>`
* `sug_ignore_db[]=<db name>`
		
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
		
		"status": <"ok" – also when no definitions found|"error">,
		
		"msg": <Status message>
	}