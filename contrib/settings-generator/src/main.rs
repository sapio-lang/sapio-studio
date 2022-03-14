#![allow(dead_code)]
#![allow(unused_variables)]
use sapio_bitcoin::secp256k1::PublicKey;
use schemars::schema::SchemaObject;
use schemars::JsonSchema;
use serde::Serialize;
use std::collections::HashMap;
use std::net::SocketAddrV4;
use std::path::Path;
use std::path::PathBuf;
#[derive(Serialize)]
struct FilePicker(PathBuf);
impl JsonSchema for FilePicker {
    fn json_schema(gen: &mut schemars::gen::SchemaGenerator) -> schemars::schema::Schema {
        let mut schema: SchemaObject = <Path>::json_schema(gen).into();
        schema.format = Some("file".to_owned());
        schema.into()
    }
    fn schema_name() -> std::string::String {
        "File".into()
    }
}
#[derive(Serialize)]
struct Password(String);
impl JsonSchema for Password {
    fn json_schema(gen: &mut schemars::gen::SchemaGenerator) -> schemars::schema::Schema {
        let mut schema: SchemaObject = <Path>::json_schema(gen).into();
        schema.format = Some("password".to_owned());
        schema.into()
    }
    fn schema_name() -> std::string::String {
        "Password".into()
    }
}

/// # Human Readable Nickname
/// e.g., my_hot_wallet
#[derive(Serialize, JsonSchema)]
struct Nickname(String);

/// # Module Hash
/// (64 char hex)
#[derive(Serialize, JsonSchema)]
struct ModuleHash(String);

/// # Public Key
/// e.g. xpubD6...
#[derive(Serialize, JsonSchema)]
struct PK(String);

/// # Network Interface
/// e.g., hello.com:1010, 0.0.0.0:8080
#[derive(Serialize, JsonSchema)]
struct IFace(String);

/// # Configuration Source
#[derive(Serialize, JsonSchema)]
enum Preferences {
    /// # Here
    /// From Sapio-Studio,
    /// Configuration parameters done locally.
    Here {
        /// # Custom Plugin Mapping
        /// Map of nicknames to module hashes
        plugin_map: Vec<(Nickname, ModuleHash)>,
        /// # Use Emulation?
        /// Whether or not Emulation should be used
        use_emulation: bool,
        /// # Emulators
        /// Which Emulators to query?
        emulators: Vec<(PK, IFace)>,
        /// # Emulator Threshold (should set to # of emulators usually)
        /// How many Emulators must sign?
        threshold: u16,
    },
    /// # File
    /// Use a custom config file
    File {
        /// # Configuration File:
        config: FilePicker,
    },
    /// # Default
    /// Use sapio-cli's default settings configuration
    Default,
}

/// # Local Oracle
/// If Sapio Studio should run a local oracle, what seed file and interface to use.
#[derive(Serialize, JsonSchema)]
enum LocalOracle {
    /// # Enabled
    /// An oracle will be run & managed by Sapio Studio
    Enabled {
        /// # Seed File
        file: FilePicker,
        /// # Interface
        /// (e.g. 0.0.0.0:8080)
        interface: SocketAddrV4,
    },

    /// # Disabled
    /// No oracle will be run.
    Disabled,
}

/// # sapio-cli Studio Configuration
#[derive(JsonSchema, Serialize)]
struct SapioCliConfig {
    /// # Binary
    /// sapio-cli Binary Location
    sapio_cli: FilePicker,
    /// # Preferences
    /// How to configure the options for sapio-cli
    preferences: Preferences,
}

/// # Animation Speed
#[derive(JsonSchema, Serialize)]
enum AnimationSpeed {
    /// # Disable Animation
    Disabled,
    /// # Enable Animation (ms)
    Enabled(#[schemars(range(min = 50, max = 5000))] u64),
}

/// # To Show Sats or Bitcoin
#[derive(JsonSchema, Serialize)]
enum SatsOrBitcoin {
    /// # After Threshold
    /// min = 0, max = 100000000 (1 btc)
    BitcoinAfter(#[schemars(range(min = 0, max = 100000000))] u64),
    /// # Always Sats
    AlwaysSats(()),
    /// # Always Bitcoin
    AlwaysBitcoin(()),
}
/// # Display Settings
#[derive(JsonSchema, Serialize)]
struct DisplaySettings {
    /// # Threshold at which to display Bitcoin () or Sats ()
    satoshis: SatsOrBitcoin,
    /// # Animation Speed
    /// The speed (in ms) to animate at
    animation_speed: AnimationSpeed,
    /// # Bitcoin Node Polling Frequency (seconds)
    node_polling_freq: u64,
}

/// # Bitcoin Settings
#[derive(JsonSchema, Serialize)]
struct Bitcoin {
    /// # Which Network
    network: Network,
    /// # RPC Port
    port: u64,
    /// # Host
    /// E.g., 0.0.0.0 or mynode.com
    host: String,
    /// # Credentials
    auth: Auth,
}
#[derive(JsonSchema, Serialize)]
pub enum Network {
    /// # Classic Bitcoin
    Bitcoin,
    /// # Bitcoin's testnet
    Testnet,
    /// # Bitcoin's signet
    Signet,
    /// # Bitcoin's regtest
    Regtest,
}

// note: remote type matched
/// # Auth File
#[derive(JsonSchema, Serialize)]
enum Auth {
    /// # No Authentication
    None,
    /// # Username / Password
    UserPass(String, Password),
    /// # Cookie File
    CookieFile(FilePicker),
}

impl Default for LocalOracle {
    fn default() -> Self {
        LocalOracle::Disabled
    }
}

impl Default for SapioCliConfig {
    fn default() -> Self {
        SapioCliConfig {
            preferences: Preferences::Here {
                plugin_map: Default::default(),
                use_emulation: false,
                threshold: 1,
                emulators: Default::default(),
            },
            sapio_cli: FilePicker(Default::default()),
        }
    }
}
impl Default for DisplaySettings {
    fn default() -> Self {
        DisplaySettings {
            animation_speed: AnimationSpeed::Enabled(500),
            node_polling_freq: 10,
            satoshis: SatsOrBitcoin::BitcoinAfter(100_000),
        }
    }
}

impl Default for Bitcoin {
    fn default() -> Self {
        Bitcoin {
            auth: Auth::UserPass(
                "Put Your Username".into(),
                Password("Put Your Password".into()),
            ),
            network: Network::Signet,
            host: "0.0.0.0".into(),
            port: 38332,
        }
    }
}
use schemars::schema_for;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("import {{ JSONSchema7 }} from 'json-schema';");
    let j = serde_json::json! {{
        "sapio_cli": schema_for!(SapioCliConfig),
        "local_oracle": schema_for!(LocalOracle),
        "display": schema_for!(DisplaySettings),
        "bitcoin": schema_for!(Bitcoin),
    }};
    println!(
        "export type schema_t = {{ {} }};",
        j.as_object()
            .unwrap()
            .keys()
            .map(|k| format!("\"{}\":JSONSchema7,", k))
            .collect::<Vec<String>>()
            .join("")
    );
    let js = serde_json::to_string_pretty(&j)?;
    println!("export const schemas : schema_t = {};", js);

    let def = serde_json::json! {{
        "sapio_cli":    SapioCliConfig::default(),
        "local_oracle": LocalOracle::default(),
        "display":      DisplaySettings::default(),
        "bitcoin":      Bitcoin::default(),
    }};
    println!(
        "export const default_settings = {};",
        serde_json::to_string_pretty(&def)?
    );

    Ok(())
}
