/* eslint-env node */
module.exports = {
  "env": {
    "es6": true,
    "browser": true,
    "webextensions": true
  },
  "parserOptions": {
    "sourceType": "module",
    "ecmaVersion": 9
  },
  "rules": {
    "indent": [
      "error",
      2,
      {"SwitchCase": 1}
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single",
      {
        "avoidEscape": true,
        "allowTemplateLiterals": true
      }
    ],
    "semi": [
      "error",
      "always"
    ],
    "strict": [
      "error",
      "global"
    ]
  }
}
