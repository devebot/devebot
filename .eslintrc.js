module.exports = {
    "extends": "standard",
    "rules": {
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "warn",
            "double"
        ],
        "semi": [
            "warn",
            "always"
        ],
        "no-console": ["error", {
            "allow": ["time", "timeEnd", "info", "error"]
        }],
        "camelcase": ["warn"],
        "prefer-promise-reject-errors": ["warn", {
        }],
        "no-inner-declarations": ["warn"],
        "promise/param-names": ["warn"],
        "no-unmodified-loop-condition": ["warn"],
        "no-useless-escape": ["warn"],
        "eol-last": ["warn"],
        "space-before-function-paren": ["warn", {
            "anonymous": "ignore",
            "named": "always",
            "asyncArrow": "ignore"
        }],
        "comma-dangle": ["error", {
            "arrays": "only-multiline",
            "objects": "only-multiline",
            "imports": "never",
            "exports": "never",
            "functions": "ignore"
        }]
    }
};