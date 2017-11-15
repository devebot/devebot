module.exports = {
	application: {
		"host": "0.0.0.0",
		"port": 17700,
		"verbose": false
	},
	bridges: {
		"anyname1a": {
			"bridge1": {
				"refPath": "sandbox -> bridge1 -> anyname1a"
			}
		},
		"anyname1b": {
			"bridge1": {
				"refPath": "sandbox -> bridge1 -> anyname1b"
			}
		},
		"anyname2a": {
			"bridge2": {
				"refPath": "sandbox -> bridge2 -> anyname2a"
			}
		},
		"anyname2b": {
			"bridge2": {
				"refPath": "sandbox -> bridge2 -> anyname2b"
			}
		},
		"anyname2c": {
			"bridge2": {
				"refPath": "sandbox -> bridge2 -> anyname2c"
			}
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