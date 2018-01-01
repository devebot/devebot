module.exports = {
	application: {
		"host": "127.0.0.1",
		"port": 17700,
		"verbose": true
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
		}
	},
	plugins: {
		"plugin1": {
			"host": "0.0.0.0",
			"port": 17701
		},
		"plugin2": {
			"host": "0.0.0.0",
			"port": 17702
		}
	}
}