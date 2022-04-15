import { JSONSchema7 } from 'json-schema';
export type schema_t = { "bitcoin":JSONSchema7,"display":JSONSchema7,"local_oracle":JSONSchema7,"sapio_cli":JSONSchema7, };
export const schemas : schema_t = {
  "bitcoin": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "definitions": {
      "Auth": {
        "oneOf": [
          {
            "enum": [
              "None"
            ],
            "type": "string"
          },
          {
            "additionalProperties": false,
            "properties": {
              "UserPass": {
                "items": [
                  {
                    "type": "string"
                  },
                  {
                    "$ref": "#/definitions/Password"
                  }
                ],
                "maxItems": 2,
                "minItems": 2,
                "type": "array"
              }
            },
            "required": [
              "UserPass"
            ],
            "title": "Username / Password",
            "type": "object"
          },
          {
            "additionalProperties": false,
            "properties": {
              "CookieFile": {
                "$ref": "#/definitions/File"
              }
            },
            "required": [
              "CookieFile"
            ],
            "title": "Cookie File",
            "type": "object"
          }
        ],
        "title": "Auth File"
      },
      "File": {
        "format": "custom::filename",
        "type": "string"
      },
      "Network": {
        "enum": [
          "Bitcoin",
          "Testnet",
          "Signet",
          "Regtest"
        ],
        "type": "string"
      },
      "Password": {
        "format": "password",
        "type": "string"
      }
    },
    "properties": {
      "auth": {
        "allOf": [
          {
            "$ref": "#/definitions/Auth"
          }
        ],
        "title": "Credentials"
      },
      "host": {
        "description": "E.g., 0.0.0.0 or mynode.com",
        "title": "Host",
        "type": "string"
      },
      "network": {
        "allOf": [
          {
            "$ref": "#/definitions/Network"
          }
        ],
        "title": "Which Network"
      },
      "port": {
        "format": "uint64",
        "minimum": 0.0,
        "title": "RPC Port",
        "type": "integer"
      }
    },
    "required": [
      "auth",
      "host",
      "network",
      "port"
    ],
    "title": "Bitcoin Settings",
    "type": "object"
  },
  "display": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "definitions": {
      "AnimationSpeed": {
        "oneOf": [
          {
            "enum": [
              "Disabled"
            ],
            "type": "string"
          },
          {
            "additionalProperties": false,
            "properties": {
              "Enabled": {
                "format": "uint64",
                "maximum": 5000.0,
                "minimum": 50.0,
                "type": "integer"
              }
            },
            "required": [
              "Enabled"
            ],
            "title": "Enable Animation (ms)",
            "type": "object"
          }
        ],
        "title": "Animation Speed"
      },
      "SatsOrBitcoin": {
        "oneOf": [
          {
            "additionalProperties": false,
            "description": "min = 0, max = 100000000 (1 btc)",
            "properties": {
              "BitcoinAfter": {
                "format": "uint64",
                "maximum": 100000000.0,
                "minimum": 0.0,
                "type": "integer"
              }
            },
            "required": [
              "BitcoinAfter"
            ],
            "title": "After Threshold",
            "type": "object"
          },
          {
            "additionalProperties": false,
            "properties": {
              "AlwaysSats": {
                "type": "null"
              }
            },
            "required": [
              "AlwaysSats"
            ],
            "title": "Always Sats",
            "type": "object"
          },
          {
            "additionalProperties": false,
            "properties": {
              "AlwaysBitcoin": {
                "type": "null"
              }
            },
            "required": [
              "AlwaysBitcoin"
            ],
            "title": "Always Bitcoin",
            "type": "object"
          }
        ],
        "title": "To Show Sats or Bitcoin"
      }
    },
    "properties": {
      "animation_speed": {
        "allOf": [
          {
            "$ref": "#/definitions/AnimationSpeed"
          }
        ],
        "description": "The speed (in ms) to animate at",
        "title": "Animation Speed"
      },
      "node_polling_freq": {
        "format": "uint64",
        "minimum": 0.0,
        "title": "Bitcoin Node Polling Frequency (seconds)",
        "type": "integer"
      },
      "satoshis": {
        "allOf": [
          {
            "$ref": "#/definitions/SatsOrBitcoin"
          }
        ],
        "title": "Threshold at which to display Bitcoin () or Sats ()"
      }
    },
    "required": [
      "animation_speed",
      "node_polling_freq",
      "satoshis"
    ],
    "title": "Display Settings",
    "type": "object"
  },
  "local_oracle": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "definitions": {
      "File": {
        "format": "custom::filename",
        "type": "string"
      }
    },
    "description": "If Sapio Studio should run a local oracle, what seed file and interface to use.",
    "oneOf": [
      {
        "enum": [
          "Disabled"
        ],
        "type": "string"
      },
      {
        "additionalProperties": false,
        "description": "An oracle will be run & managed by Sapio Studio",
        "properties": {
          "Enabled": {
            "properties": {
              "file": {
                "allOf": [
                  {
                    "$ref": "#/definitions/File"
                  }
                ],
                "title": "Seed File"
              },
              "interface": {
                "description": "(e.g. 0.0.0.0:8080)",
                "title": "Interface",
                "type": "string"
              }
            },
            "required": [
              "file",
              "interface"
            ],
            "type": "object"
          }
        },
        "required": [
          "Enabled"
        ],
        "title": "Enabled",
        "type": "object"
      }
    ],
    "title": "Local Oracle"
  },
  "sapio_cli": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "definitions": {
      "File": {
        "format": "custom::filename",
        "type": "string"
      },
      "IFace": {
        "description": "e.g., hello.com:1010, 0.0.0.0:8080",
        "title": "Network Interface",
        "type": "string"
      },
      "ModuleHash": {
        "description": "(64 char hex)",
        "title": "Module Hash",
        "type": "string"
      },
      "Nickname": {
        "description": "e.g., my_hot_wallet",
        "title": "Human Readable Nickname",
        "type": "string"
      },
      "PK": {
        "description": "e.g. xpubD6...",
        "title": "Public Key",
        "type": "string"
      },
      "Preferences": {
        "oneOf": [
          {
            "enum": [
              "Default"
            ],
            "type": "string"
          },
          {
            "additionalProperties": false,
            "description": "From Sapio-Studio, Configuration parameters done locally.",
            "properties": {
              "Here": {
                "properties": {
                  "emulators": {
                    "description": "Which Emulators to query?",
                    "items": {
                      "items": [
                        {
                          "$ref": "#/definitions/PK"
                        },
                        {
                          "$ref": "#/definitions/IFace"
                        }
                      ],
                      "maxItems": 2,
                      "minItems": 2,
                      "type": "array"
                    },
                    "title": "Emulators",
                    "type": "array"
                  },
                  "plugin_map": {
                    "description": "Map of nicknames to module hashes",
                    "items": {
                      "items": [
                        {
                          "$ref": "#/definitions/Nickname"
                        },
                        {
                          "$ref": "#/definitions/ModuleHash"
                        }
                      ],
                      "maxItems": 2,
                      "minItems": 2,
                      "type": "array"
                    },
                    "title": "Custom Plugin Mapping",
                    "type": "array"
                  },
                  "threshold": {
                    "description": "How many Emulators must sign?",
                    "format": "uint16",
                    "minimum": 0.0,
                    "title": "Emulator Threshold (should set to # of emulators usually)",
                    "type": "integer"
                  },
                  "use_emulation": {
                    "description": "Whether or not Emulation should be used",
                    "title": "Use Emulation?",
                    "type": "boolean"
                  }
                },
                "required": [
                  "emulators",
                  "plugin_map",
                  "threshold",
                  "use_emulation"
                ],
                "type": "object"
              }
            },
            "required": [
              "Here"
            ],
            "title": "Here",
            "type": "object"
          },
          {
            "additionalProperties": false,
            "description": "Use a custom config file",
            "properties": {
              "File": {
                "$ref": "#/definitions/File"
              }
            },
            "required": [
              "File"
            ],
            "title": "File",
            "type": "object"
          }
        ],
        "title": "Configuration Source"
      }
    },
    "properties": {
      "preferences": {
        "allOf": [
          {
            "$ref": "#/definitions/Preferences"
          }
        ],
        "description": "How to configure the options for sapio-cli",
        "title": "Preferences"
      },
      "sapio_cli": {
        "allOf": [
          {
            "$ref": "#/definitions/File"
          }
        ],
        "description": "sapio-cli Binary Location",
        "title": "Binary"
      }
    },
    "required": [
      "preferences",
      "sapio_cli"
    ],
    "title": "sapio-cli Studio Configuration",
    "type": "object"
  }
};
export const default_settings = {
  "bitcoin": {
    "auth": {
      "UserPass": [
        "Put Your Username",
        "Put Your Password"
      ]
    },
    "host": "0.0.0.0",
    "network": "Signet",
    "port": 38332
  },
  "display": {
    "animation_speed": {
      "Enabled": 500
    },
    "node_polling_freq": 10,
    "satoshis": {
      "BitcoinAfter": 100000
    }
  },
  "local_oracle": "Disabled",
  "sapio_cli": {
    "preferences": {
      "Here": {
        "emulators": [],
        "plugin_map": [],
        "threshold": 1,
        "use_emulation": false
      }
    },
    "sapio_cli": ""
  }
};
