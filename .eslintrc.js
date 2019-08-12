module.exports = {
  "env": {
    "node": true
  },
  "extends": "standard",
  "rules": {
    "no-undef": "error",
    "no-unused-vars": "error",
    "no-inner-declarations": ["error"],
    "camelcase": "warn",
    "curly": "error",
    "no-undef-init": "error",
    "no-constant-condition": "error",
    "no-console": ["error", {
      "allow": ["time", "timeEnd", "info", "error", "warn"]
    }],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "one-var": "warn",
    "quotes": [
      "warn",
      "double"
    ],
    "semi": [
      "warn",
      "always"
    ],
    "prefer-promise-reject-errors": ["warn"],
    "promise/param-names": ["warn"],
    "no-unmodified-loop-condition": ["error"],
    "no-useless-escape": ["warn"],
    "eol-last": ["error"],
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
    }],
    // for development
    "indent": "off",
    "no-multi-spaces": "off",
    "no-trailing-spaces": "error",
    "handle-callback-err": "error",
    "spaced-comment": "off",
    "object-property-newline": "off",
    "object-curly-spacing": "off",
    "no-template-curly-in-string": "off",
    "no-unneeded-ternary": "off",
    "no-return-assign": "off",
    "eqeqeq": "off",
    "operator-linebreak": "error",
    "space-infix-ops": "off",
    "no-mixed-operators": "off",
    "space-unary-ops": "off",
    "keyword-spacing": "error",
    "no-unreachable": "off",
    "standard/array-bracket-even-spacing": "off",
    "yoda": "error"
  }
};
