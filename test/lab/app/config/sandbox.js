module.exports = {
	application: {
		"host": "0.0.0.0",
		"port": 17700,
		"verbose": false
	},
	bridges: {
		"anyname1a": {
			"bridge1": {}
		},
		"anyname1b": {
			"bridge1": {}
		},
		"anyname2a": {
			"bridge2": {}
		},
		"anyname2b": {
			"bridge2": {}
		}
	},
	plugins: {
		"plugin1": {
			"host": "0.0.0.0",
			"port": 17701,
			"verbose": false
		},
		"plugin2": {
			"host": "0.0.0.0",
			"port": 17702,
			"verbose": false
		}
	}
}